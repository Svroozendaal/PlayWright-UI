import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, RegisteredProject, WizardParams, ProjectSettingsUpdate } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'
import { ConflictError } from '../services/ProjectTemplateService'

export function registerProjectHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.PROJECTS_LIST,
    async (): Promise<IpcEnvelope<RegisteredProject[]>> => {
      try {
        const projects = services.projectRegistry.listProjects()
        return { version: 1, payload: projects }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.PROJECTS_CREATE,
    async (
      _event,
      envelope: { version: 1; payload?: WizardParams }
    ): Promise<IpcEnvelope<RegisteredProject>> => {
      try {
        const params = envelope.payload
        if (!params?.projectName || !params?.rootPath) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectName and rootPath are required' } }
        }

        // Use template service to scaffold the project
        await services.projectTemplate.create(params)

        // Register in database
        const project = services.projectRegistry.addProject(params.projectName, params.rootPath, 'created')
        return { version: 1, payload: project }
      } catch (err) {
        const message = String(err)
        if (err instanceof ConflictError) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_EXISTS, message } }
        }
        if (message.includes('already registered')) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_EXISTS, message } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message } }
      }
    }
  )

  ipcMain.handle(
    IPC.PROJECTS_IMPORT,
    async (
      _event,
      envelope: { version: 1; payload?: { rootPath: string } }
    ): Promise<IpcEnvelope<RegisteredProject>> => {
      try {
        const rootPath = envelope.payload?.rootPath ?? ''
        if (!rootPath) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'rootPath is required' } }
        }
        const project = services.projectRegistry.importProject(rootPath)
        return { version: 1, payload: project }
      } catch (err) {
        const message = String(err)
        if (message.includes('already registered')) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_EXISTS, message } }
        }
        if (message.includes('does not exist') || message.includes('not a directory')) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message } }
      }
    }
  )

  ipcMain.handle(
    IPC.PROJECTS_GET,
    async (
      _event,
      envelope: { version: 1; payload?: { id: string } }
    ): Promise<IpcEnvelope<RegisteredProject>> => {
      try {
        const id = envelope.payload?.id ?? ''
        const project = services.projectRegistry.getProject(id)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: `Project not found: ${id}` } }
        }
        return { version: 1, payload: project }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.PROJECTS_OPEN,
    async (
      _event,
      envelope: { version: 1; payload?: { id: string } }
    ): Promise<IpcEnvelope<RegisteredProject>> => {
      try {
        const id = envelope.payload?.id ?? ''
        const project = services.projectRegistry.openProject(id)

        // Start file watcher for this project
        services.fileWatch.watchProject(project.id, project.rootPath)

        return { version: 1, payload: project }
      } catch (err) {
        const message = String(err)
        if (message.includes('not found')) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message } }
      }
    }
  )

  ipcMain.handle(
    IPC.PROJECTS_REMOVE,
    async (
      _event,
      envelope: { version: 1; payload?: { id: string } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const id = envelope.payload?.id ?? ''
        services.projectRegistry.removeProject(id)
        return { version: 1 }
      } catch (err) {
        const message = String(err)
        if (message.includes('not found')) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message } }
      }
    }
  )

  ipcMain.handle(
    IPC.PROJECTS_UPDATE_SETTINGS,
    async (
      _event,
      envelope: { version: 1; payload?: ProjectSettingsUpdate }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId is required' } }
        }

        const project = services.projectRegistry.getProject(p.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }

        if (p.defaultBrowser !== undefined) {
          services.db
            .prepare('UPDATE projects SET defaultBrowser = ?, updatedAt = ? WHERE id = ?')
            .run(p.defaultBrowser, new Date().toISOString(), p.projectId)
        }

        if (p.activeEnvironment !== undefined) {
          services.environment.setActiveEnvironment(p.projectId, p.activeEnvironment)
          services.db
            .prepare('UPDATE projects SET updatedAt = ? WHERE id = ?')
            .run(new Date().toISOString(), p.projectId)
        }

        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
