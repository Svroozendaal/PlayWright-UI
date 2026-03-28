import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema } from './common'

export const dashboardRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.DASHBOARD_GET_STATS,
    tags: ['Dashboard'],
    summary: 'Get dashboard stats for a project',
    operationId: 'getDashboardStats',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      return services.dashboard.getStats(project.id)
    },
  },
]
