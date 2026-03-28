import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema } from './common'

export const healthRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.HEALTH_GET,
    tags: ['Health'],
    summary: 'Get cached health snapshot for a project',
    operationId: 'getHealth',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => services.projectHealth.get((params as { id: string }).id),
  },
  {
    method: 'post',
    path: API_ROUTES.HEALTH_REFRESH,
    tags: ['Health'],
    summary: 'Refresh health snapshot for a project',
    operationId: 'refreshHealth',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      return services.projectHealth.refresh(project.id, project.rootPath)
    },
  },
  {
    method: 'get',
    path: API_ROUTES.HEALTH_GET_CONFIG,
    tags: ['Health'],
    summary: 'Get Playwright config summary needed by the UI',
    operationId: 'getProjectConfigSummary',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      const config = services.playwrightConfig.get(project.id, project.rootPath)
      return { projects: config.projects }
    },
  },
]
