import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, CodegenOptions, RecorderStatus } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'
import { RecorderAlreadyRunningError } from '../services/RecorderService'

export function registerRecorderHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.RECORDER_START,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } & CodegenOptions }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId || !p.outputPath) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId and outputPath are required' } }
        }
        const project = services.projectRegistry.getProject(p.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }
        services.recorder.start(project.rootPath, {
          startUrl: p.startUrl,
          outputPath: p.outputPath,
          browser: p.browser,
        })
        return { version: 1 }
      } catch (err) {
        if (err instanceof RecorderAlreadyRunningError) {
          return { version: 1, error: { code: ERROR_CODES.RECORDER_ALREADY_RUNNING, message: String(err) } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.RECORDER_STOP,
    async (): Promise<IpcEnvelope<void>> => {
      try {
        services.recorder.stop()
        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.RECORDER_STATUS,
    async (): Promise<IpcEnvelope<RecorderStatus>> => {
      try {
        const status = services.recorder.getStatus()
        return { version: 1, payload: status }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.RECORDER_SAVE,
    async (
      _event,
      envelope: { version: 1; payload?: { outputPath: string } }
    ): Promise<IpcEnvelope<string | null>> => {
      try {
        const outputPath = envelope.payload?.outputPath ?? ''
        if (!outputPath) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'outputPath is required' } }
        }
        const file = services.recorder.getOutputFile(outputPath)
        return { version: 1, payload: file }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
