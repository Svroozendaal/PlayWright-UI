import { z } from 'zod'
import { API_ROUTES, ERROR_CODES, type RunRequest } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { ApiRouteError } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema, runIdParamSchema, throwRunNotFound } from './common'
import { ActiveRunError } from '../services/RunService'
import { EnvironmentNotFoundError } from '../services/EnvironmentService'

const runRequestSchema = z.object({
  projectId: z.string().min(1),
  target: z.string().optional(),
  targetPath: z.string().optional(),
  testTitleFilter: z.string().optional(),
  grepPattern: z.string().optional(),
  grepInvert: z.boolean().optional(),
  tagFilter: z.string().optional(),
  browser: z.union([
    z.object({ mode: z.literal('single'), projectName: z.string().min(1) }),
    z.object({ mode: z.literal('all') }),
  ]),
  environment: z.string().optional(),
  headed: z.boolean().optional(),
  debug: z.boolean().optional(),
  baseURLOverride: z.string().optional(),
  extraEnv: z.record(z.string(), z.string()).optional(),
  streamLogs: z.boolean().optional(),
})

export const runRoutes: RouteDefinition[] = [
  {
    method: 'post',
    path: API_ROUTES.RUNS_START,
    tags: ['Runs'],
    summary: 'Start a new run for a project',
    operationId: 'startRun',
    schemas: {
      params: idParamSchema,
      body: runRequestSchema,
    },
    handler: async ({ services, params, body }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      const request = body as RunRequest
      request.projectId = project.id

      if (request.environment) {
        try {
          const resolved = await services.environment.resolveForRun(
            project.id,
            project.rootPath,
            request.environment,
            { baseURL: request.baseURLOverride, env: request.extraEnv }
          )
          request.baseURLOverride = resolved.baseURL || request.baseURLOverride
          request.extraEnv = { ...request.extraEnv, ...resolved.env }
        } catch (error) {
          if (error instanceof EnvironmentNotFoundError) {
            throw new ApiRouteError(ERROR_CODES.ENVIRONMENT_NOT_FOUND, error.message, 404)
          }
          throw error
        }
      }

      try {
        return services.run.startRun(request, project.rootPath)
      } catch (error) {
        if (error instanceof ActiveRunError) {
          throw new ApiRouteError(ERROR_CODES.ACTIVE_RUN_EXISTS, error.message, 409)
        }
        throw error
      }
    },
  },
  {
    method: 'get',
    path: API_ROUTES.RUNS_GET_ACTIVE,
    tags: ['Runs'],
    summary: 'Get the active run id',
    operationId: 'getActiveRun',
    schemas: { params: idParamSchema },
    handler: ({ services }) => services.run.getActiveRunId(),
  },
  {
    method: 'get',
    path: API_ROUTES.RUNS_LIST,
    tags: ['Runs'],
    summary: 'List runs for a project',
    operationId: 'listRuns',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => services.run.listRuns((params as { id: string }).id),
  },
  {
    method: 'get',
    path: API_ROUTES.RUNS_GET_BY_ID,
    tags: ['Runs'],
    summary: 'Get a run by id',
    operationId: 'getRunById',
    schemas: { params: runIdParamSchema },
    handler: ({ services, params }) => {
      const runId = (params as { runId: string }).runId
      const run = services.run.getRun(runId)
      if (!run) throwRunNotFound(runId)
      return run
    },
  },
  {
    method: 'delete',
    path: API_ROUTES.RUNS_CANCEL,
    tags: ['Runs'],
    summary: 'Cancel the active run',
    operationId: 'cancelRun',
    schemas: { params: runIdParamSchema },
    handler: ({ services, params }) => services.run.cancelRun((params as { runId: string }).runId),
  },
  {
    method: 'post',
    path: API_ROUTES.RUNS_RERUN,
    tags: ['Runs'],
    summary: 'Rerun an existing run',
    operationId: 'rerunRun',
    schemas: { params: runIdParamSchema },
    handler: async ({ services, params }) => {
      const runId = (params as { runId: string }).runId
      const originalRun = services.run.getRun(runId)
      if (!originalRun) throwRunNotFound(runId)

      const project = getProjectOrThrow(services, originalRun.projectId)
      const browser = originalRun.browserJson
        ? JSON.parse(originalRun.browserJson)
        : { mode: 'all' as const }

      const request: RunRequest = {
        projectId: originalRun.projectId,
        target: originalRun.target ?? undefined,
        targetPath: originalRun.targetPath ?? undefined,
        browser,
        environment: originalRun.environment ?? undefined,
        headed: !!originalRun.headed,
        debug: !!originalRun.debug,
        streamLogs: true,
      }

      try {
        return services.run.startRun(request, project.rootPath)
      } catch (error) {
        if (error instanceof ActiveRunError) {
          throw new ApiRouteError(ERROR_CODES.ACTIVE_RUN_EXISTS, error.message, 409)
        }
        throw error
      }
    },
  },
  {
    method: 'get',
    path: API_ROUTES.RUNS_GET_TEST_RESULTS,
    tags: ['Runs'],
    summary: 'Get test results for a run',
    operationId: 'getRunResults',
    schemas: { params: runIdParamSchema },
    handler: ({ services, params }) => services.run.getTestResults((params as { runId: string }).runId),
  },
]
