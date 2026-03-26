import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { ChildProcess } from 'child_process'
import type Database from 'better-sqlite3'
import type { BrowserWindow } from 'electron'
import { IPC } from '../../shared/types/ipc'
import type { RunRequest, RunRecord, TestResultRecord, LogEvent } from '../../shared/types/ipc'
import { spawnPlaywright } from '../utils/playwrightBinary'
import { buildCommand, buildEnvVars } from './CommandBuilder'
import { parseJsonReport, determineOutcome } from './RunResultParser'
import type { FlakyTrackingService } from './FlakyTrackingService'

export class RunService {
  private db: Database.Database
  private win: BrowserWindow
  private activeProcess: ChildProcess | null = null
  private activeRunId: string | null = null
  private flakyTracking: FlakyTrackingService | null = null

  constructor(db: Database.Database, win: BrowserWindow) {
    this.db = db
    this.win = win
  }

  setFlakyTracking(service: FlakyTrackingService): void {
    this.flakyTracking = service
  }

  async startRun(request: RunRequest, rootPath: string): Promise<string> {
    // Check for active run
    if (this.activeRunId) {
      throw new ActiveRunError('A run is already in progress')
    }

    const runId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Create run directory
    const runDir = path.join(rootPath, '.artifacts', 'runs', runId)
    fs.mkdirSync(runDir, { recursive: true })
    fs.mkdirSync(path.join(runDir, 'traces'), { recursive: true })
    fs.mkdirSync(path.join(runDir, 'screenshots'), { recursive: true })
    fs.mkdirSync(path.join(runDir, 'videos'), { recursive: true })
    const logPath = path.join(runDir, 'log.txt')
    fs.writeFileSync(logPath, '')

    // Build command
    const command = buildCommand(request, runDir)
    const envVars = buildEnvVars(request)

    // Insert run record
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

    // Spawn playwright
    const proc = spawnPlaywright(command, rootPath, envVars)
    this.activeProcess = proc

    // Update status to running
    this.db.prepare("UPDATE runs SET status = 'running' WHERE id = ?").run(runId)
    this.win.webContents.send(IPC.RUNS_STATUS_CHANGED, { runId, status: 'running' })

    // Stream stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString('utf8').split('\n')
      for (const line of lines) {
        if (!line) continue
        fs.appendFileSync(logPath, line + '\n')
        if (request.streamLogs) {
          const event: LogEvent = { runId, line, timestamp: new Date().toISOString(), source: 'stdout' }
          this.win.webContents.send(IPC.RUNS_LOG_EVENT, event)
        }
      }
    })

    // Stream stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString('utf8').split('\n')
      for (const line of lines) {
        if (!line) continue
        fs.appendFileSync(logPath, `[stderr] ${line}\n`)
        if (request.streamLogs) {
          const event: LogEvent = { runId, line, timestamp: new Date().toISOString(), source: 'stderr' }
          this.win.webContents.send(IPC.RUNS_LOG_EVENT, event)
        }
      }
    })

    // Handle process close
    proc.on('close', (exitCode: number | null) => {
      this.activeProcess = null
      this.activeRunId = null

      const resultsPath = path.join(runDir, 'results.json')
      const reportPath = path.join(runDir, 'report', 'index.html')
      const finishedAt = new Date().toISOString()

      // Determine outcome
      const outcome = determineOutcome(exitCode, resultsPath)

      // Parse results if available
      if (outcome !== 'config-error' && fs.existsSync(resultsPath)) {
        const testResults = parseJsonReport(resultsPath, runId)
        this.storeTestResults(testResults)

        // Update flaky test tracking
        if (this.flakyTracking) {
          try {
            this.flakyTracking.updateFromRun(request.projectId, runId)
          } catch {
            // Non-critical — don't fail the run
          }
        }
      }

      // Update run record
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

      // Notify renderer
      this.win.webContents.send(IPC.RUNS_STATUS_CHANGED, { runId, status: outcome, finishedAt })
    })

    return runId
  }

  async cancelRun(runId: string): Promise<void> {
    if (this.activeRunId !== runId || !this.activeProcess) {
      throw new Error('No active run to cancel')
    }

    const proc = this.activeProcess

    // SIGTERM first
    if (process.platform === 'win32') {
      // Windows: use taskkill to kill process tree
      const { execSync } = await import('child_process')
      try {
        execSync(`taskkill /pid ${proc.pid} /T /F`, { timeout: 5000 })
      } catch {
        // Process may have already exited
      }
    } else {
      proc.kill('SIGTERM')

      // SIGKILL after 3 seconds if still running
      setTimeout(() => {
        if (this.activeProcess === proc) {
          proc.kill('SIGKILL')
        }
      }, 3000)
    }

    // Update status
    this.db.prepare("UPDATE runs SET status = 'cancelled', finishedAt = ? WHERE id = ?").run(
      new Date().toISOString(),
      runId
    )

    this.activeProcess = null
    this.activeRunId = null

    this.win.webContents.send(IPC.RUNS_STATUS_CHANGED, { runId, status: 'cancelled' })
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
      for (const r of results) {
        stmt.run(r.id, r.runId, r.testTitle, r.status, r.duration, r.errorMessage, r.tracePath, r.screenshotPath, r.videoPath, r.retryCount)
      }
    })()
  }
}

export class ActiveRunError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActiveRunError'
  }
}
