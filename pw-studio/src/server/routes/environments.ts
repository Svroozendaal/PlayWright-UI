import { z } from 'zod'
import { API_ROUTES, WS_EVENTS, type Environment } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getProjectOrThrow, envIdParamSchema, idParamSchema } from './common'

const environmentSchema = z.object({
  name: z.string().min(1),
  baseURL: z.string(),
  variables: z.record(z.string(), z.string()),
  secretRefs: z.record(z.string(), z.string()),
})

const environmentBodySchema = z.object({
  projectId: z.string().min(1),
  environment: environmentSchema,
})

const environmentDeleteQuerySchema = z.object({
  projectId: z.string().min(1),
})

export const environmentRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.ENVIRONMENTS_LIST,
    tags: ['Environments'],
    summary: 'List environments for a project',
    operationId: 'listEnvironments',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      return services.environment.listEnvironments(project.id, project.rootPath)
    },
  },
  {
    method: 'post',
    path: API_ROUTES.ENVIRONMENTS_CREATE,
    tags: ['Environments'],
    summary: 'Create an environment file',
    operationId: 'createEnvironment',
    schemas: {
      params: idParamSchema,
      body: z.object({ environment: environmentSchema }),
    },
    handler: ({ services, params, body }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      const environment = (body as { environment: Environment }).environment
      services.environment.saveEnvironment(project.id, project.rootPath, environment)
      services.broadcast(WS_EVENTS.ENVIRONMENTS_CHANGED, { projectId: project.id })
      return undefined
    },
  },
  {
    method: 'put',
    path: API_ROUTES.ENVIRONMENTS_UPDATE,
    tags: ['Environments'],
    summary: 'Update an environment file',
    operationId: 'updateEnvironment',
    schemas: {
      params: envIdParamSchema,
      body: environmentBodySchema,
    },
    handler: ({ services, params, body }) => {
      const payload = body as z.infer<typeof environmentBodySchema>
      const envId = (params as { envId: string }).envId
      const project = getProjectOrThrow(services, payload.projectId)
      const environment = { ...payload.environment, name: envId }
      services.environment.saveEnvironment(project.id, project.rootPath, environment)
      services.broadcast(WS_EVENTS.ENVIRONMENTS_CHANGED, { projectId: project.id })
      return undefined
    },
  },
  {
    method: 'delete',
    path: API_ROUTES.ENVIRONMENTS_DELETE,
    tags: ['Environments'],
    summary: 'Delete an environment file',
    operationId: 'deleteEnvironment',
    schemas: {
      params: envIdParamSchema,
      query: environmentDeleteQuerySchema,
    },
    handler: async ({ services, params, query }) => {
      const envId = (params as { envId: string }).envId
      const project = getProjectOrThrow(services, (query as { projectId: string }).projectId)
      await services.environment.deleteEnvironment(project.id, project.rootPath, envId)
      services.broadcast(WS_EVENTS.ENVIRONMENTS_CHANGED, { projectId: project.id })
      return undefined
    },
  },
]
