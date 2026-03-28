import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema } from './common'
import { z } from 'zod'

const flakyHistoryParamsSchema = z.object({
  id: z.string().min(1),
  testTitle: z.string().min(1),
})

export const flakyRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.FLAKY_LIST,
    tags: ['Flaky'],
    summary: 'List flaky tests for a project',
    operationId: 'listFlakyTests',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      return services.flakyTracking.getFlakyTests(project.id)
    },
  },
  {
    method: 'get',
    path: API_ROUTES.FLAKY_TEST_HISTORY,
    tags: ['Flaky'],
    summary: 'Get run history for a test title',
    operationId: 'getFlakyTestHistory',
    schemas: { params: flakyHistoryParamsSchema },
    handler: ({ services, params }) =>
      services.flakyTracking.getTestHistory(
        (params as z.infer<typeof flakyHistoryParamsSchema>).id,
        (params as z.infer<typeof flakyHistoryParamsSchema>).testTitle
      ),
  },
]
