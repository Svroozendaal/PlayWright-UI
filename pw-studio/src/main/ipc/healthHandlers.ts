import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, HealthSnapshot } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerHealthHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.HEALTH_GET,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } }
    ): Promise<IpcEnvelope<HealthSnapshot | null>> => {
      try {
        const projectId = envelope.payload?.projectId ?? ''
        if (!projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }

        const snapshot = services.projectHealth.get(projectId)
        return { version: 1, payload: snapshot }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.HEALTH_REFRESH,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } }
    ): Promise<IpcEnvelope<HealthSnapshot>> => {
      try {
        const projectId = envelope.payload?.projectId ?? ''
        if (!projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }

        const project = services.projectRegistry.getProject(projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: `Project not found: ${projectId}` } }
        }

        const snapshot = await services.projectHealth.refresh(projectId, project.rootPath)
        return { version: 1, payload: snapshot }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.HEALTH_CHECK_FAILED, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.HEALTH_GET_CONFIG,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } }
    ): Promise<IpcEnvelope<{ projects: string[] }>> => {
      try {
        const projectId = envelope.payload?.projectId ?? ''
        if (!projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }

        const project = services.projectRegistry.getProject(projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: `Project not found: ${projectId}` } }
        }

        const config = services.playwrightConfig.get(projectId, project.rootPath)
        return { version: 1, payload: { projects: config.projects } }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
