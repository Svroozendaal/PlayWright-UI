import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, Environment } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerEnvironmentHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.ENVIRONMENTS_LIST,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } }
    ): Promise<IpcEnvelope<Environment[]>> => {
      try {
        const projectId = envelope.payload?.projectId ?? ''
        if (!projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }
        const project = services.projectRegistry.getProject(projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }
        const envs = services.environment.listEnvironments(projectId, project.rootPath)
        return { version: 1, payload: envs }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.ENVIRONMENTS_CREATE,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; environment: Environment } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId || !p.environment?.name) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId and environment are required' } }
        }
        const project = services.projectRegistry.getProject(p.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }
        services.environment.saveEnvironment(p.projectId, project.rootPath, p.environment)
        services.win.webContents.send(IPC.ENVIRONMENTS_CHANGED, { projectId: p.projectId })
        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.ENVIRONMENTS_UPDATE,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; environment: Environment } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId || !p.environment?.name) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId and environment are required' } }
        }
        const project = services.projectRegistry.getProject(p.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }
        services.environment.saveEnvironment(p.projectId, project.rootPath, p.environment)
        services.win.webContents.send(IPC.ENVIRONMENTS_CHANGED, { projectId: p.projectId })
        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.ENVIRONMENTS_DELETE,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; name: string } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId || !p.name) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId and name are required' } }
        }
        const project = services.projectRegistry.getProject(p.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }
        await services.environment.deleteEnvironment(p.projectId, project.rootPath, p.name)
        services.win.webContents.send(IPC.ENVIRONMENTS_CHANGED, { projectId: p.projectId })
        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
