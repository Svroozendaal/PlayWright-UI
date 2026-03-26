import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, RunRequest, RunRecord, TestResultRecord } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'
import { ActiveRunError } from '../services/RunService'
import { EnvironmentNotFoundError } from '../services/EnvironmentService'

export function registerRunHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.RUNS_START,
    async (
      _event,
      envelope: { version: 1; payload?: RunRequest }
    ): Promise<IpcEnvelope<string>> => {
      try {
        const request = envelope.payload
        if (!request?.projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }

        const project = services.projectRegistry.getProject(request.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }

        // Resolve environment if specified
        if (request.environment) {
          try {
            const resolved = await services.environment.resolveForRun(
              request.projectId,
              project.rootPath,
              request.environment,
              { baseURL: request.baseURLOverride, env: request.extraEnv }
            )
            request.baseURLOverride = resolved.baseURL || request.baseURLOverride
            request.extraEnv = { ...request.extraEnv, ...resolved.env }
          } catch (envErr) {
            if (envErr instanceof EnvironmentNotFoundError) {
              return { version: 1, error: { code: ERROR_CODES.ENVIRONMENT_NOT_FOUND, message: String(envErr) } }
            }
            throw envErr
          }
        }

        const runId = await services.run.startRun(request, project.rootPath)
        return { version: 1, payload: runId }
      } catch (err) {
        if (err instanceof ActiveRunError) {
          return { version: 1, error: { code: ERROR_CODES.ACTIVE_RUN_EXISTS, message: String(err) } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.RUNS_GET_ACTIVE,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } }
    ): Promise<IpcEnvelope<string | null>> => {
      try {
        const activeId = services.run.getActiveRunId()
        return { version: 1, payload: activeId }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.RUNS_LIST,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } }
    ): Promise<IpcEnvelope<RunRecord[]>> => {
      try {
        const projectId = envelope.payload?.projectId ?? ''
        if (!projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }
        const runs = services.run.listRuns(projectId)
        return { version: 1, payload: runs }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.RUNS_GET_BY_ID,
    async (
      _event,
      envelope: { version: 1; payload?: { runId: string } }
    ): Promise<IpcEnvelope<RunRecord>> => {
      try {
        const runId = envelope.payload?.runId ?? ''
        const run = services.run.getRun(runId)
        if (!run) {
          return { version: 1, error: { code: ERROR_CODES.RUN_NOT_FOUND, message: `Run not found: ${runId}` } }
        }
        return { version: 1, payload: run }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.RUNS_CANCEL,
    async (
      _event,
      envelope: { version: 1; payload?: { runId: string } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const runId = envelope.payload?.runId ?? ''
        await services.run.cancelRun(runId)
        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.RUNS_RERUN,
    async (
      _event,
      envelope: { version: 1; payload?: { runId: string } }
    ): Promise<IpcEnvelope<string>> => {
      try {
        const runId = envelope.payload?.runId ?? ''
        const originalRun = services.run.getRun(runId)
        if (!originalRun) {
          return { version: 1, error: { code: ERROR_CODES.RUN_NOT_FOUND, message: `Run not found: ${runId}` } }
        }

        const project = services.projectRegistry.getProject(originalRun.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }

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
      } catch (err) {
        if (err instanceof ActiveRunError) {
          return { version: 1, error: { code: ERROR_CODES.ACTIVE_RUN_EXISTS, message: String(err) } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  // Fetch test results for a run
  ipcMain.handle(
    IPC.RUNS_GET_TEST_RESULTS,
    async (
      _event,
      envelope: { version: 1; payload?: { runId: string } }
    ): Promise<IpcEnvelope<TestResultRecord[]>> => {
      try {
        const runId = envelope.payload?.runId ?? ''
        const results = services.run.getTestResults(runId)
        return { version: 1, payload: results }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
