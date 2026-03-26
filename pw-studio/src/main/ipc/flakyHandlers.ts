import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, FlakyTestRecord, TestHistoryEntry } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerFlakyHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.FLAKY_LIST,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } }
    ): Promise<IpcEnvelope<FlakyTestRecord[]>> => {
      try {
        const projectId = envelope.payload?.projectId ?? ''
        if (!projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }
        const records = services.flakyTracking.getFlakyTests(projectId)
        return { version: 1, payload: records }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.FLAKY_TEST_HISTORY,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; testTitle: string } }
    ): Promise<IpcEnvelope<TestHistoryEntry[]>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId || !p.testTitle) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId and testTitle are required' } }
        }
        const entries = services.flakyTracking.getTestHistory(p.projectId, p.testTitle)
        return { version: 1, payload: entries }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
