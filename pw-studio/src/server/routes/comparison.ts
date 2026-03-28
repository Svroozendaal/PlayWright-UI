import { z } from 'zod'
import { API_ROUTES, ERROR_CODES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { ApiRouteError } from '../middleware/envelope'

const runCompareQuerySchema = z.object({
  a: z.string().min(1),
  b: z.string().min(1),
})

export const comparisonRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.RUNS_COMPARE,
    tags: ['Runs'],
    summary: 'Compare two runs',
    operationId: 'compareRuns',
    schemas: { query: runCompareQuerySchema },
    handler: ({ services, query }) => {
      const { a, b } = query as z.infer<typeof runCompareQuerySchema>
      const comparison = services.runComparison.compare(a, b)
      if (!comparison) {
        throw new ApiRouteError(ERROR_CODES.RUN_NOT_FOUND, 'One or both runs not found', 404)
      }
      return comparison
    },
  },
]
