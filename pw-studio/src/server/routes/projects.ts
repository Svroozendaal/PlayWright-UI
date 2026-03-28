import { z } from 'zod'
import { API_ROUTES, ERROR_CODES, type ProjectSettingsUpdate, type WizardParams } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { ApiRouteError } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema } from './common'
import { ConflictError } from '../services/ProjectTemplateService'

const createProjectBodySchema = z.object({
  projectName: z.string().min(1),
  rootPath: z.string().min(1),
  browsers: z.array(z.string()).default([]),
  includeExampleTests: z.boolean(),
  includeAuth: z.boolean(),
  includePageObjects: z.boolean(),
  includeFixtures: z.boolean(),
})

const importProjectBodySchema = z.object({
  rootPath: z.string().min(1),
})

const updateProjectSettingsBodySchema = z.object({
  projectId: z.string().min(1),
  defaultBrowser: z.string().nullable().optional(),
  activeEnvironment: z.string().nullable().optional(),
})

export const projectRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.PROJECTS_LIST,
    tags: ['Projects'],
    summary: 'List registered projects',
    operationId: 'listProjects',
    handler: ({ services }) => services.projectRegistry.listProjects(),
  },
  {
    method: 'post',
    path: API_ROUTES.PROJECTS_CREATE,
    tags: ['Projects'],
    summary: 'Create and register a new Playwright project',
    operationId: 'createProject',
    schemas: { body: createProjectBodySchema },
    handler: async ({ services, body }) => {
      try {
        const params = body as WizardParams
        await services.projectTemplate.create(params)
        return services.projectRegistry.addProject(params.projectName, params.rootPath, 'created')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (error instanceof ConflictError || message.includes('already registered')) {
          throw new ApiRouteError(ERROR_CODES.PROJECT_EXISTS, message, 409)
        }
        throw error
      }
    },
  },
  {
    method: 'post',
    path: API_ROUTES.PROJECTS_IMPORT,
    tags: ['Projects'],
    summary: 'Import an existing Playwright project',
    operationId: 'importProject',
    schemas: { body: importProjectBodySchema },
    handler: ({ services, body }) => {
      try {
        return services.projectRegistry.importProject((body as { rootPath: string }).rootPath)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('already registered')) {
          throw new ApiRouteError(ERROR_CODES.PROJECT_EXISTS, message, 409)
        }
        if (message.includes('does not exist') || message.includes('not a directory')) {
          throw new ApiRouteError(ERROR_CODES.INVALID_PATH, message, 400)
        }
        throw error
      }
    },
  },
  {
    method: 'get',
    path: API_ROUTES.PROJECTS_GET,
    tags: ['Projects'],
    summary: 'Get a registered project',
    operationId: 'getProject',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => getProjectOrThrow(services, (params as { id: string }).id),
  },
  {
    method: 'post',
    path: API_ROUTES.PROJECTS_OPEN,
    tags: ['Projects'],
    summary: 'Open a project and start file watching',
    operationId: 'openProject',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const id = (params as { id: string }).id
      const project = services.projectRegistry.openProject(id)
      services.fileWatch.watchProject(project.id, project.rootPath)
      return project
    },
  },
  {
    method: 'delete',
    path: API_ROUTES.PROJECTS_REMOVE,
    tags: ['Projects'],
    summary: 'Remove a registered project',
    operationId: 'removeProject',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const id = (params as { id: string }).id
      services.fileWatch.unwatchProject(id)
      services.projectRegistry.removeProject(id)
      return undefined
    },
  },
  {
    method: 'patch',
    path: API_ROUTES.PROJECTS_UPDATE_SETTINGS,
    tags: ['Projects'],
    summary: 'Update stored project settings',
    operationId: 'updateProjectSettings',
    schemas: {
      params: idParamSchema,
      body: updateProjectSettingsBodySchema,
    },
    handler: ({ services, params, body }) => {
      const projectId = (params as { id: string }).id
      const payload = body as ProjectSettingsUpdate
      const project = getProjectOrThrow(services, projectId)

      if (payload.projectId && payload.projectId !== projectId) {
        throw new ApiRouteError(ERROR_CODES.INVALID_INPUT, 'projectId does not match route id', 400)
      }

      if (payload.defaultBrowser !== undefined) {
        services.db
          .prepare('UPDATE projects SET defaultBrowser = ?, updatedAt = ? WHERE id = ?')
          .run(payload.defaultBrowser, new Date().toISOString(), project.id)
      }

      if (payload.activeEnvironment !== undefined) {
        services.environment.setActiveEnvironment(project.id, payload.activeEnvironment)
        services.db
          .prepare('UPDATE projects SET updatedAt = ? WHERE id = ?')
          .run(new Date().toISOString(), project.id)
      }

      return undefined
    },
  },
]
