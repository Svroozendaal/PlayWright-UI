import { z } from 'zod'
import { API_ROUTES, ERROR_CODES, type RunRequest } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { ApiRouteError } from '../middleware/envelope'
import { runIdParamSchema, throwRunNotFound, getProjectOrThrow } from './common'
import { ActiveRunError } from '../services/RunService'
import { spawnPlaywright } from '../utils/playwrightBinary'

const openArtifactBodySchema = z.object({
  filePath: z.string().min(1),
})

const openReportBodySchema = z.object({
  runId: z.string().min(1),
})

const showTraceBodySchema = z.object({
  projectId: z.string().min(1),
  tracePath: z.string().min(1),
})

export const artifactRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.ARTIFACTS_LIST_BY_RUN,
    tags: ['Artifacts'],
    summary: 'List test results that have artifacts',
    operationId: 'listArtifactsByRun',
    schemas: { params: runIdParamSchema },
    handler: ({ services, params }) =>
      services.run
        .getTestResults((params as { runId: string }).runId)
        .filter((result) => result.tracePath || result.screenshotPath || result.videoPath),
  },
  {
    method: 'post',
    path: API_ROUTES.ARTIFACTS_OPEN,
    tags: ['Artifacts'],
    summary: 'Open an artifact path in the OS shell',
    operationId: 'openArtifact',
    schemas: { body: openArtifactBodySchema },
    handler: ({ services, body }) => {
      services.artifact.openArtifact((body as { filePath: string }).filePath)
      return undefined
    },
  },
  {
    method: 'post',
    path: API_ROUTES.ARTIFACTS_OPEN_REPORT,
    tags: ['Artifacts'],
    summary: 'Open a run report in the OS shell',
    operationId: 'openReport',
    schemas: { body: openReportBodySchema },
    handler: ({ services, body }) => {
      const runId = (body as { runId: string }).runId
      const run = services.run.getRun(runId)
      if (!run?.reportPath) {
        throwRunNotFound(runId)
      }
      services.artifact.openReport(run.reportPath)
      return undefined
    },
  },
  {
    method: 'post',
    path: API_ROUTES.ARTIFACTS_SHOW_TRACE,
    tags: ['Artifacts'],
    summary: 'Open Playwright trace viewer for a trace path',
    operationId: 'showTrace',
    schemas: { body: showTraceBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof showTraceBodySchema>
      const project = getProjectOrThrow(services, payload.projectId)
      const proc = spawnPlaywright(['show-trace', payload.tracePath], project.rootPath)
      proc.unref()
      return undefined
    },
  },
  {
    method: 'post',
    path: API_ROUTES.RUNS_RERUN_FAILED,
    tags: ['Artifacts'],
    summary: 'Rerun failed tests from a previous run',
    operationId: 'rerunFailed',
    schemas: { params: runIdParamSchema },
    handler: async ({ services, params }) => {
      const runId = (params as { runId: string }).runId
      const originalRun = services.run.getRun(runId)
      if (!originalRun) throwRunNotFound(runId)

      if (originalRun.status === 'config-error') {
        throw new ApiRouteError(
          ERROR_CODES.UNKNOWN,
          'Cannot rerun failed tests for config-error runs. Use normal rerun instead.',
          400
        )
      }

      const project = getProjectOrThrow(services, originalRun.projectId)
      const testResults = services.run.getTestResults(runId)
      const failedResults = testResults.filter(
        (result) => result.status === 'failed' || result.status === 'timedOut'
      )

      if (failedResults.length === 0) {
        throw new ApiRouteError(ERROR_CODES.UNKNOWN, 'No failed tests to rerun', 400)
      }

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

      if (failedResults.length !== testResults.length) {
        request.testTitleFilter = failedResults
          .map((result) => result.safeTitleForGrep ?? result.testTitle)
          .join('|')
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
]
