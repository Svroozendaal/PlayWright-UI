import { ipcMain } from 'electron'
import { IPC } from '../../shared/types/ipc'
import type { IpcEnvelope, DashboardStats } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerDashboardHandlers(services: ServiceContainer): void {
  ipcMain.handle(IPC.DASHBOARD_GET_STATS, async (
    _event,
    envelope: { version: 1; payload?: { projectId: string } }
  ): Promise<IpcEnvelope<DashboardStats>> => {
    try {
      const projectId = envelope.payload?.projectId ?? ''
      if (!projectId) {
        return { version: 1, error: { code: 'INVALID_INPUT', message: 'projectId is required' } }
      }
      const stats = services.dashboard.getStats(projectId)
      return { version: 1, payload: stats }
    } catch (err) {
      return { version: 1, error: { code: 'UNKNOWN', message: (err as Error).message } }
    }
  })

  ipcMain.handle(IPC.EXPLORER_GET_LAST_RESULTS, async (
    _event,
    envelope: { version: 1; payload?: { projectId: string } }
  ): Promise<IpcEnvelope<Record<string, string>>> => {
    try {
      const projectId = envelope.payload?.projectId ?? ''
      if (!projectId) {
        return { version: 1, error: { code: 'INVALID_INPUT', message: 'projectId is required' } }
      }
      // Get the most recent completed run
      const lastRun = services.db
        .prepare(
          `SELECT id FROM runs WHERE projectId = ? AND status IN ('passed', 'failed') ORDER BY startedAt DESC LIMIT 1`
        )
        .get(projectId) as { id: string } | undefined

      if (!lastRun) {
        return { version: 1, payload: {} }
      }

      const results = services.db
        .prepare(`SELECT testTitle, status FROM run_test_results WHERE runId = ?`)
        .all(lastRun.id) as { testTitle: string; status: string }[]

      const statusMap: Record<string, string> = {}
      for (const r of results) {
        statusMap[r.testTitle] = r.status
      }

      return { version: 1, payload: statusMap }
    } catch (err) {
      return { version: 1, error: { code: 'UNKNOWN', message: (err as Error).message } }
    }
  })
}
