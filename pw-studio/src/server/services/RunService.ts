import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { ChildProcess } from 'child_process'
import type Database from 'better-sqlite3'
import { ERROR_CODES, WS_EVENTS } from '../../shared/types/ipc'
import type {
  RunRequest,
  RunRecord,
  RunStatus,
  TestResultRecord,
  LogEvent,
} from '../../shared/types/ipc'
import { spawnPlaywright } from '../utils/playwrightBinary'
import { createRunConfigOverride } from '../utils/playwrightConfigOverride'
import { buildCommand, buildEnvVars, normalizeTargetPathForPlaywright } from './CommandBuilder'
import { parseJsonReport, determineOutcome } from './RunResultParser'
import type { FlakyTrackingService } from './FlakyTrackingService'
import { ApiRouteError } from '../middleware/envelope'

export class RunService {
  private db: Database.Database

  private publish: (channel: string, data: unknown) => void

  private activeProcess: ChildProcess | null = null

  private activeRunId: string | null = null

  private flakyTracking: FlakyTrackingService | null = null

  constructor(db: Database.Database, publish: (channel: string, data: unknown) => void) {
    this.db = db
    this.publish = publish
  }

  setFlakyTracking(service: FlakyTrackingService): void {
    this.flakyTracking = service
  }

  async startRun(request: RunRequest, rootPath: string): Promise<string> {
    if (this.activeRunId) {
      throw new ActiveRunError('A run is already in progress')
    }

    const runId = crypto.randomUUID()
    const now = new Date().toISOString()
    const runDir = path.join(rootPath, '.artifacts', 'runs', runId)
    const reportDir = path.join(rootPath, '.artifacts', 'reports', runId)

    fs.mkdirSync(runDir, { recursive: true })
    const logPath = path.join(runDir, 'log.txt')
    this.ensureLogFile(logPath)

    const overrideConfigPath = createRunConfigOverride(rootPath, runId, runDir, reportDir, {
      testDir: request.testDirOverride,
    }) ?? undefined
    const commandRequest: RunRequest = {
      ...request,
      targetPath: normalizeTargetPathForPlaywright(rootPath, request.targetPath),
    }
    const command = buildCommand(commandRequest, runDir, undefined, overrideConfigPath)
    const envVars = buildEnvVars(request)

    this.db
      .prepare(
        `INSERT INTO runs (id, projectId, status, target, targetPath, browserJson, environment, headed, debug, commandJson, runDir, logPath, startedAt)
         VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        runId,
        request.projectId,
        request.target ?? null,
        request.targetPath ?? null,
        JSON.stringify(request.browser),
        request.environment ?? null,
        request.headed ? 1 : 0,
        request.debug ? 1 : 0,
        JSON.stringify(command),
        runDir,
        logPath,
        now
      )

    this.activeRunId = runId
    const proc = spawnPlaywright(command, rootPath, envVars)
    this.activeProcess = proc
    let finalized = false

    proc.stdout?.setEncoding('utf8')
    proc.stderr?.setEncoding('utf8')

    this.db.prepare("UPDATE runs SET status = 'running' WHERE id = ?").run(runId)
    this.publish(WS_EVENTS.RUNS_STATUS_CHANGED, { runId, status: 'running' })

    const finalizeRun = (exitCode: number | null, forcedOutcome?: RunStatus): void => {
      if (finalized) {
        return
      }
      finalized = true

      this.activeProcess = null
      this.activeRunId = null

      const resultsPath = path.join(runDir, 'results.json')
      const reportPath = path.join(reportDir, 'index.html')
      const finishedAt = new Date().toISOString()
      const currentRun = this.getRun(runId)
      const existingStatus = currentRun?.status
      let outcome: RunStatus = forcedOutcome ?? determineOutcome(exitCode, resultsPath)

      if (existingStatus === 'cancelled') {
        outcome = 'cancelled'
      }

      if (outcome !== 'config-error' && outcome !== 'cancelled' && fs.existsSync(resultsPath)) {
        const testResults = parseJsonReport(resultsPath, runId)
        this.storeTestResults(testResults)

        if (this.flakyTracking) {
          try {
            this.flakyTracking.updateFromRun(request.projectId, runId)
          } catch {
            // Keep the run successful even if flaky tracking cannot be updated.
          }
        }
      }

      this.db
        .prepare(
          `UPDATE runs SET status = ?, exitCode = ?, resultsPath = ?, reportPath = ?, finishedAt = ?
           WHERE id = ?`
        )
        .run(
          outcome,
          exitCode,
          fs.existsSync(resultsPath) ? resultsPath : null,
          fs.existsSync(reportPath) ? reportPath : null,
          finishedAt,
          runId
        )

      if (overrideConfigPath) {
        try {
          fs.unlinkSync(overrideConfigPath)
        } catch {
          // Ignore cleanup failures for generated config overrides.
        }
      }

      this.publish(WS_EVENTS.RUNS_STATUS_CHANGED, { runId, status: outcome, finishedAt })
    }

    proc.stdout?.on('data', (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (!line) {
          continue
        }

        this.appendLogLine(logPath, line)
        if (request.streamLogs) {
          const event: LogEvent = {
            runId,
            line,
            timestamp: new Date().toISOString(),
            source: 'stdout',
          }
          this.publish(WS_EVENTS.RUNS_LOG_EVENT, event)
        }
      }
    })

    proc.stderr?.on('data', (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (!line) {
          continue
        }

        this.appendLogLine(logPath, `[stderr] ${line}`)
        if (request.streamLogs) {
          const event: LogEvent = {
            runId,
            line,
            timestamp: new Date().toISOString(),
            source: 'stderr',
          }
          this.publish(WS_EVENTS.RUNS_LOG_EVENT, event)
        }
      }
    })

    proc.on('error', (error: Error) => {
      this.appendLogLine(logPath, `[pw-studio] Failed to start run: ${error.message}`)
      finalizeRun(null, 'config-error')
    })

    proc.on('close', (exitCode: number | null) => {
      finalizeRun(exitCode)
    })

    return runId
  }

  async cancelRun(runId: string): Promise<void> {
    if (this.activeRunId !== runId || !this.activeProcess) {
      throw new ApiRouteError(ERROR_CODES.RUN_NOT_FOUND, 'No active run to cancel', 404)
    }

    const proc = this.activeProcess

    if (process.platform === 'win32') {
      const { execSync } = await import('child_process')
      try {
        execSync(`taskkill /pid ${proc.pid} /T /F`, { timeout: 5000 })
      } catch {
        // Process may have already exited.
      }
    } else {
      proc.kill('SIGTERM')
      setTimeout(() => {
        if (this.activeProcess === proc) {
          proc.kill('SIGKILL')
        }
      }, 3000)
    }

    this.db.prepare("UPDATE runs SET status = 'cancelled', finishedAt = ? WHERE id = ?").run(
      new Date().toISOString(),
      runId
    )

    this.activeProcess = null
    this.activeRunId = null

    this.publish(WS_EVENTS.RUNS_STATUS_CHANGED, { runId, status: 'cancelled' })
  }

  getActiveRunId(): string | null {
    return this.activeRunId
  }

  getRun(runId: string): RunRecord | undefined {
    return this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as RunRecord | undefined
  }

  listRuns(projectId: string): RunRecord[] {
    return this.db
      .prepare('SELECT * FROM runs WHERE projectId = ? ORDER BY startedAt DESC')
      .all(projectId) as RunRecord[]
  }

  getCaptureMeta(runId: string, tempFile: string, storageStatePath: string): { lastUrl: string | null; storageStatePath: string } {
    // Clean up the temp spec file
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile) } catch { /* ignore */ }

    // Read the meta file written by the capture test
    const metaPath = storageStatePath.replace('.json', '-meta.json')
    let lastUrl: string | null = null
    try {
      if (fs.existsSync(metaPath)) {
        const raw = fs.readFileSync(metaPath, 'utf8')
        lastUrl = (JSON.parse(raw) as { url?: string }).url ?? null
      }
    } catch { /* ignore */ }

    return { lastUrl, storageStatePath }
  }

  getRecordedSnippet(runId: string): string | null {
    const run = this.getRun(runId)
    if (!run?.logPath || !fs.existsSync(run.logPath)) return null
    const log = fs.readFileSync(run.logPath, 'utf8')
    // PWDEBUG=1 prints the generated code to stdout after the user closes the Inspector.
    // The output is a full .spec.ts file. We locate the last test(...) call and return
    // just the snippet (without the import header) so it can be parsed by syncCode.
    const lines = log.split(/\r?\n/)
    let startIdx = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i] ?? ''
      // Match lines like: test('title', async ({ page }) => {
      if (/^\s*test(?:\.\w+)?\s*\(/.test(line)) {
        startIdx = i
        break
      }
    }
    if (startIdx === -1) return null
    return lines.slice(startIdx).join('\n').trim() || null
  }

  getTestResults(runId: string): TestResultRecord[] {
    return this.db
      .prepare('SELECT * FROM run_test_results WHERE runId = ?')
      .all(runId) as TestResultRecord[]
  }

  private storeTestResults(results: TestResultRecord[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO run_test_results (id, runId, testTitle, status, duration, errorMessage, tracePath, screenshotPath, videoPath, retryCount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    this.db.transaction(() => {
      for (const result of results) {
        stmt.run(
          result.id,
          result.runId,
          result.testTitle,
          result.status,
          result.duration,
          result.errorMessage,
          result.tracePath,
          result.screenshotPath,
          result.videoPath,
          result.retryCount
        )
      }
    })()
  }

  private ensureLogFile(logPath: string): void {
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '')
    }
  }

  private appendLogLine(logPath: string, line: string): void {
    try {
      this.ensureLogFile(logPath)
      fs.appendFileSync(logPath, `${line}\n`)
    } catch (error) {
      console.error('[pw-studio] failed to append run log', error)
    }
  }
}

export class ActiveRunError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActiveRunError'
  }
}
