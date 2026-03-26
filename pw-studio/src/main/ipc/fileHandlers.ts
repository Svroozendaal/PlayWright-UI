import { ipcMain } from 'electron'
import { IPC } from '../../shared/types/ipc'
import type { IpcEnvelope } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerFileHandlers(services: ServiceContainer): void {
  ipcMain.handle(IPC.FILE_READ, async (
    _event,
    envelope: { version: 1; payload?: { projectId: string; filePath: string } }
  ): Promise<IpcEnvelope<{ content: string; encoding: 'utf-8'; size: number; lastModified: string }>> => {
    try {
      const p = envelope.payload
      if (!p?.projectId || !p.filePath) {
        return { version: 1, error: { code: 'INVALID_PATH', message: 'projectId and filePath are required' } }
      }
      const project = services.projectRegistry.getProject(p.projectId)
      if (!project) {
        return { version: 1, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } }
      }
      const result = services.file.readFile(project.rootPath, p.filePath)
      return { version: 1, payload: result }
    } catch (err) {
      return { version: 1, error: { code: 'INVALID_PATH', message: (err as Error).message } }
    }
  })

  ipcMain.handle(IPC.FILE_WRITE, async (
    _event,
    envelope: { version: 1; payload?: { projectId: string; filePath: string; content: string } }
  ): Promise<IpcEnvelope<{ success: boolean }>> => {
    try {
      const p = envelope.payload
      if (!p?.projectId || !p.filePath) {
        return { version: 1, error: { code: 'INVALID_PATH', message: 'projectId and filePath are required' } }
      }
      const project = services.projectRegistry.getProject(p.projectId)
      if (!project) {
        return { version: 1, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } }
      }
      services.file.writeFile(project.rootPath, p.filePath, p.content)
      return { version: 1, payload: { success: true } }
    } catch (err) {
      return { version: 1, error: { code: 'INVALID_PATH', message: (err as Error).message } }
    }
  })

  ipcMain.handle(IPC.FILE_CREATE, async (
    _event,
    envelope: { version: 1; payload?: { projectId: string; filePath: string; content: string; isDirectory?: boolean } }
  ): Promise<IpcEnvelope<{ success: boolean }>> => {
    try {
      const p = envelope.payload
      if (!p?.projectId || !p.filePath) {
        return { version: 1, error: { code: 'INVALID_PATH', message: 'projectId and filePath are required' } }
      }
      const project = services.projectRegistry.getProject(p.projectId)
      if (!project) {
        return { version: 1, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } }
      }
      if (p.isDirectory) {
        services.file.createDirectory(project.rootPath, p.filePath)
      } else {
        services.file.createFile(project.rootPath, p.filePath, p.content)
      }
      return { version: 1, payload: { success: true } }
    } catch (err) {
      return { version: 1, error: { code: 'INVALID_PATH', message: (err as Error).message } }
    }
  })
}
