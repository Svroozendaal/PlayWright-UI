import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, TestResultRecord, RunRequest } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'
import type { FileArtifactPolicy } from '../services/ArtifactService'
import { ActiveRunError } from '../services/RunService'
import { spawnPlaywright } from '../utils/playwrightBinary'

export function registerArtifactHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.ARTIFACTS_LIST_BY_RUN,
    async (
      _event,
      envelope: { version: 1; payload?: { runId: string } }
    ): Promise<IpcEnvelope<TestResultRecord[]>> => {
      try {
        const runId = envelope.payload?.runId ?? ''
        const results = services.run.getTestResults(runId)
        // Filter to only those with artifacts
        const withArtifacts = results.filter(
          (r) => r.tracePath || r.screenshotPath || r.videoPath
        )
        return { version: 1, payload: withArtifacts }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.ARTIFACTS_OPEN,
    async (
      _event,
      envelope: { version: 1; payload?: { filePath: string } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const filePath = envelope.payload?.filePath ?? ''
        services.artifact.openArtifact(filePath)
        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.ARTIFACTS_OPEN_REPORT,
    async (
      _event,
      envelope: { version: 1; payload?: { runId: string } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const runId = envelope.payload?.runId ?? ''
        const run = services.run.getRun(runId)
        if (!run?.reportPath) {
          return { version: 1, error: { code: ERROR_CODES.RUN_NOT_FOUND, message: 'Report not found' } }
        }
        services.artifact.openReport(run.reportPath)
        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.ARTIFACTS_SHOW_TRACE,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; tracePath: string } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId || !p.tracePath) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId and tracePath are required' } }
        }
        const project = services.projectRegistry.getProject(p.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }
        // Spawn playwright show-trace in the background
        const proc = spawnPlaywright(['show-trace', p.tracePath], project.rootPath)
        proc.unref()
        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  // rerunFailed
  ipcMain.handle(
    IPC.RUNS_RERUN_FAILED,
    async (
      _event,
      envelope: { version: 1; payload?: { runId: string } }
    ): Promise<IpcEnvelope<string>> => {
      try {
        const runId = envelope.payload?.runId ?? ''
        const originalRun = services.run.getRun(runId)
        if (!originalRun) {
          return { version: 1, error: { code: ERROR_CODES.RUN_NOT_FOUND, message: 'Run not found' } }
        }

        if (originalRun.status === 'config-error') {
          return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: 'Cannot rerun failed for config-error runs. Use normal rerun instead.' } }
        }

        const project = services.projectRegistry.getProject(originalRun.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }

        const testResults = services.run.getTestResults(runId)
        const failedResults = testResults.filter(
          (r) => r.status === 'failed' || r.status === 'timedOut'
        )

        if (failedResults.length === 0) {
          return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: 'No failed tests to rerun' } }
        }

        // If all tests failed, use normal rerun
        if (failedResults.length === testResults.length) {
          const browser = originalRun.browserJson ? JSON.parse(originalRun.browserJson) : { mode: 'all' as const }
          const request: RunRequest = {
            projectId: originalRun.projectId,
            target: originalRun.target ?? undefined,
            targetPath: originalRun.targetPath ?? undefined,
            browser,
            environment: originalRun.environment ?? undefined,
            headed: !!originalRun.headed,
            debug: !!originalRun.debug,
            streamLogs: true,
          }

          const newRunId = await services.run.startRun(request, project.rootPath)
          return { version: 1, payload: newRunId }
        }

        // Build grep pattern from failed test titles
        const grepPattern = failedResults
          .map((r) => r.safeTitleForGrep ?? r.testTitle)
          .join('|')

        const browser = originalRun.browserJson ? JSON.parse(originalRun.browserJson) : { mode: 'all' as const }

        const request: RunRequest = {
          projectId: originalRun.projectId,
          target: originalRun.target ?? undefined,
          targetPath: originalRun.targetPath ?? undefined,
          testTitleFilter: grepPattern,
          browser,
          environment: originalRun.environment ?? undefined,
          headed: !!originalRun.headed,
          debug: !!originalRun.debug,
          streamLogs: true,
        }

        const newRunId = await services.run.startRun(request, project.rootPath)
        return { version: 1, payload: newRunId }
      } catch (err) {
        if (err instanceof ActiveRunError) {
          return { version: 1, error: { code: ERROR_CODES.ACTIVE_RUN_EXISTS, message: String(err) } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  // File policy handlers (replace stubs from Phase 3)
  ipcMain.removeHandler(IPC.EXPLORER_GET_FILE_POLICY)
  ipcMain.handle(
    IPC.EXPLORER_GET_FILE_POLICY,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; filePath: string } }
    ): Promise<IpcEnvelope<FileArtifactPolicy | null>> => {
      try {
        const projectId = envelope.payload?.projectId ?? ''
        const filePath = envelope.payload?.filePath ?? ''
        const policy = services.artifact.getFilePolicy(projectId, filePath)
        return { version: 1, payload: policy }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.removeHandler(IPC.EXPLORER_SET_FILE_POLICY)
  ipcMain.handle(
    IPC.EXPLORER_SET_FILE_POLICY,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; filePath: string; policy: { screenshotMode: string; traceMode: string; videoMode: string } } }
    ): Promise<IpcEnvelope<FileArtifactPolicy>> => {
      try {
        const { projectId, filePath, policy } = envelope.payload ?? { projectId: '', filePath: '', policy: { screenshotMode: 'on-failure', traceMode: 'on-failure', videoMode: 'off' } }
        const result = services.artifact.setFilePolicy(projectId, filePath, policy)
        return { version: 1, payload: result }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
