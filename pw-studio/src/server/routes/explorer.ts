import { z } from 'zod'
import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import type { ServiceContainer } from '../services/ServiceContainer'
import { getProjectOrThrow, idParamSchema } from './common'

const filePolicyQuerySchema = z.object({
  filePath: z.string().min(1),
})

const filePolicyBodySchema = z.object({
  filePath: z.string().min(1),
  policy: z.object({
    screenshotMode: z.string().min(1),
    traceMode: z.string().min(1),
    videoMode: z.string().min(1),
  }),
})

async function ensureTree(
  services: ServiceContainer,
  projectId: string
): Promise<unknown> {
  let tree = services.projectIndex.getTree(projectId)

  if (!tree) {
    const project = getProjectOrThrow(services, projectId)
    tree = await services.projectIndex.buildIndex(project.id, project.rootPath)
  }

  return tree
}

export const explorerRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.EXPLORER_GET_TREE,
    tags: ['Explorer'],
    summary: 'Get explorer tree for a project',
    operationId: 'getExplorerTree',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => ensureTree(services, (params as { id: string }).id),
  },
  {
    method: 'post',
    path: API_ROUTES.EXPLORER_REFRESH,
    tags: ['Explorer'],
    summary: 'Force an explorer rebuild for a project',
    operationId: 'refreshExplorerTree',
    schemas: { params: idParamSchema },
    handler: async ({ services, params }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      services.projectIndex.invalidate(project.id)
      return services.projectIndex.buildIndex(project.id, project.rootPath)
    },
  },
  {
    method: 'get',
    path: API_ROUTES.EXPLORER_GET_FILE_POLICY,
    tags: ['Explorer'],
    summary: 'Get file-specific artifact policy',
    operationId: 'getExplorerFilePolicy',
    schemas: {
      params: idParamSchema,
      query: filePolicyQuerySchema,
    },
    handler: ({ services, params, query }) =>
      services.artifact.getFilePolicy(
        (params as { id: string }).id,
        (query as { filePath: string }).filePath
      ),
  },
  {
    method: 'put',
    path: API_ROUTES.EXPLORER_SET_FILE_POLICY,
    tags: ['Explorer'],
    summary: 'Set file-specific artifact policy',
    operationId: 'setExplorerFilePolicy',
    schemas: {
      params: idParamSchema,
      body: filePolicyBodySchema,
    },
    handler: ({ services, params, body }) => {
      const payload = body as z.infer<typeof filePolicyBodySchema>
      return services.artifact.setFilePolicy(
        (params as { id: string }).id,
        payload.filePath,
        payload.policy
      )
    },
  },
  {
    method: 'get',
    path: API_ROUTES.EXPLORER_GET_LAST_RESULTS,
    tags: ['Explorer'],
    summary: 'Get last completed test result status map for explorer annotations',
    operationId: 'getExplorerLastResults',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const projectId = (params as { id: string }).id
      const lastRun = services.db
        .prepare(
          `SELECT id FROM runs WHERE projectId = ? AND status IN ('passed', 'failed') ORDER BY startedAt DESC LIMIT 1`
        )
        .get(projectId) as { id: string } | undefined

      if (!lastRun) {
        return {}
      }

      const results = services.db
        .prepare('SELECT testTitle, status FROM run_test_results WHERE runId = ?')
        .all(lastRun.id) as { testTitle: string; status: string }[]

      const statusMap: Record<string, string> = {}
      for (const result of results) {
        statusMap[result.testTitle] = result.status
      }
      return statusMap
    },
  },
]
