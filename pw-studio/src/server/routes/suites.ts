import { z } from 'zod'
import { API_ROUTES } from '../../shared/types/ipc'
import type { SuiteEntry } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { ApiRouteError } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema } from './common'

const suiteIdParamSchema = z.object({
  id: z.string().min(1),
  suiteId: z.string().min(1),
})

const createSuiteBodySchema = z.object({
  name: z.string().min(1),
})

const browserSchema = z.union([
  z.object({ mode: z.literal('single'), projectName: z.string().min(1) }),
  z.object({ mode: z.literal('all') }),
])

const suiteEntrySchema = z.object({
  id: z.string().min(1),
  filePath: z.string().min(1),
  testTitle: z.string().nullable(),
  disabledTestTitles: z.array(z.string()),
  enabled: z.boolean(),
  flowInputOverrides: z.record(z.string(), z.string()),
  browser: browserSchema,
  environment: z.string().nullable(),
})

const updateSuiteBodySchema = z.object({
  name: z.string().min(1).optional(),
  entries: z.array(suiteEntrySchema).optional(),
})

function throwSuiteNotFound(suiteId: string): never {
  throw new ApiRouteError('SUITE_NOT_FOUND', `Suite not found: ${suiteId}`, 404)
}

export const suiteRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.SUITES_LIST,
    tags: ['Suites'],
    summary: 'List all suites for a project',
    operationId: 'listSuites',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      return services.suite.listSuites(project.rootPath)
    },
  },
  {
    method: 'post',
    path: API_ROUTES.SUITES_CREATE,
    tags: ['Suites'],
    summary: 'Create a new suite',
    operationId: 'createSuite',
    schemas: { params: idParamSchema, body: createSuiteBodySchema },
    handler: ({ services, params, body }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      const { name } = body as z.infer<typeof createSuiteBodySchema>
      return services.suite.createSuite(project.rootPath, name)
    },
  },
  {
    method: 'put',
    path: API_ROUTES.SUITES_UPDATE,
    tags: ['Suites'],
    summary: 'Update a suite name or entries',
    operationId: 'updateSuite',
    schemas: { params: suiteIdParamSchema, body: updateSuiteBodySchema },
    handler: ({ services, params, body }) => {
      const { id, suiteId } = params as z.infer<typeof suiteIdParamSchema>
      const project = getProjectOrThrow(services, id)
      const patch = body as z.infer<typeof updateSuiteBodySchema>
      const updated = services.suite.updateSuite(project.rootPath, suiteId, {
        name: patch.name,
        entries: patch.entries as SuiteEntry[] | undefined,
      })
      if (!updated) throwSuiteNotFound(suiteId)
      return updated
    },
  },
  {
    method: 'delete',
    path: API_ROUTES.SUITES_DELETE,
    tags: ['Suites'],
    summary: 'Delete a suite',
    operationId: 'deleteSuite',
    schemas: { params: suiteIdParamSchema },
    handler: ({ services, params }) => {
      const { id, suiteId } = params as z.infer<typeof suiteIdParamSchema>
      const project = getProjectOrThrow(services, id)
      const deleted = services.suite.deleteSuite(project.rootPath, suiteId)
      if (!deleted) throwSuiteNotFound(suiteId)
      return { deleted: true }
    },
  },
  {
    method: 'post',
    path: API_ROUTES.SUITES_RUN,
    tags: ['Suites'],
    summary: 'Build the ordered run list for a suite (client drives sequential execution)',
    operationId: 'runningSuite',
    schemas: { params: suiteIdParamSchema },
    handler: ({ services, params }) => {
      const { id, suiteId } = params as z.infer<typeof suiteIdParamSchema>
      const project = getProjectOrThrow(services, id)
      const suite = services.suite.getSuite(project.rootPath, suiteId)
      if (!suite) throwSuiteNotFound(suiteId)

      // Return the ordered run requests for enabled entries only.
      // The client fires them one at a time, waiting for each to complete.
      const runRequests = suite.entries
        .filter((e) => e.enabled)
        .map((entry) => {
          const req = {
            projectId: project.id,
            targetPath: entry.filePath,
            browser: entry.browser,
            environment: entry.environment ?? undefined,
            flowInputOverrides: entry.flowInputOverrides,
            // When a single test is targeted, use testTitleFilter
            ...(entry.testTitle != null
              ? { testTitleFilter: entry.testTitle }
              : entry.disabledTestTitles.length > 0
              ? {
                  grepPattern: entry.disabledTestTitles
                    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('|'),
                  grepInvert: true,
                }
              : {}),
          }
          return req
        })

      return { suiteId, runRequests }
    },
  },
]
