import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, ExplorerNode } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerExplorerHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.EXPLORER_GET_TREE,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } }
    ): Promise<IpcEnvelope<ExplorerNode[]>> => {
      try {
        const projectId = envelope.payload?.projectId ?? ''
        if (!projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }

        let tree = services.projectIndex.getTree(projectId)
        if (!tree) {
          const project = services.projectRegistry.getProject(projectId)
          if (!project) {
            return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: `Project not found: ${projectId}` } }
          }
          tree = await services.projectIndex.buildIndex(projectId, project.rootPath)
        }

        return { version: 1, payload: tree }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.EXPLORER_REFRESH,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string } }
    ): Promise<IpcEnvelope<ExplorerNode[]>> => {
      try {
        const projectId = envelope.payload?.projectId ?? ''
        if (!projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }

        const project = services.projectRegistry.getProject(projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: `Project not found: ${projectId}` } }
        }

        services.projectIndex.invalidate(projectId)
        const tree = await services.projectIndex.buildIndex(projectId, project.rootPath)
        return { version: 1, payload: tree }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  // Stubs for Phase 5
  ipcMain.handle(
    IPC.EXPLORER_GET_FILE_POLICY,
    async (): Promise<IpcEnvelope<null>> => {
      return { version: 1, payload: null }
    }
  )

  ipcMain.handle(
    IPC.EXPLORER_SET_FILE_POLICY,
    async (): Promise<IpcEnvelope<void>> => {
      return { version: 1 }
    }
  )
}
