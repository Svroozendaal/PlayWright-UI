import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, RunComparison } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerComparisonHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.RUNS_COMPARE,
    async (
      _event,
      envelope: { version: 1; payload?: { runIdA: string; runIdB: string } }
    ): Promise<IpcEnvelope<RunComparison>> => {
      try {
        const p = envelope.payload
        if (!p?.runIdA || !p.runIdB) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'runIdA and runIdB are required' } }
        }
        const comparison = services.runComparison.compare(p.runIdA, p.runIdB)
        if (!comparison) {
          return { version: 1, error: { code: ERROR_CODES.RUN_NOT_FOUND, message: 'One or both runs not found' } }
        }
        return { version: 1, payload: comparison }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
