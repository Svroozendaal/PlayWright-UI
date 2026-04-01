import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { z } from 'zod'
import { API_ROUTES, ERROR_CODES, type RunRequest, type TestEditorDocument } from '../../shared/types/ipc'
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
  flowInputOverrides: z.record(z.string(), z.string()).optional(),
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
          request.envVarsPayload = {
            baseURL: resolved.baseURL ?? '',
            ...resolved.env,
          }
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
  {
    method: 'post',
    path: API_ROUTES.RUNS_GET_CAPTURE_META,
    tags: ['Runs'],
    summary: 'Read state-capture metadata and clean up temp files after a pause-record run',
    operationId: 'getCaptureMeta',
    schemas: {
      params: runIdParamSchema,
      body: z.object({
        tempFile: z.string().min(1),
        storageStatePath: z.string().min(1),
      }),
    },
    handler: ({ services, params, body }) => {
      const { tempFile, storageStatePath } = body as { tempFile: string; storageStatePath: string }
      return services.run.getCaptureMeta(
        (params as { runId: string }).runId,
        tempFile,
        storageStatePath
      )
    },
  },
  {
    method: 'post',
    path: API_ROUTES.RUNS_MERGE_RECORDED,
    tags: ['Runs'],
    summary: 'Parse or merge newly recorded blocks from a codegen output file into the original test',
    operationId: 'mergeRecorded',
    schemas: {
      params: runIdParamSchema,
      body: z.object({
        outputPath: z.string().min(1),
        document: z.object({}).passthrough(),
        projectId: z.string().min(1),
        mode: z.enum(['dry', 'append', 'replace', 'discard']).optional(),
      }),
    },
    handler: async ({ services, body }) => {
      const { outputPath, document, projectId, mode = 'append' } = body as {
        outputPath: string
        document: TestEditorDocument
        projectId: string
        mode?: 'dry' | 'append' | 'replace' | 'discard'
      }
      const project = getProjectOrThrow(services, projectId)
      // Resolve outputPath relative to project root if it's not absolute
      const resolvedOutputPath = path.isAbsolute(outputPath)
        ? outputPath
        : path.join(project.rootPath, outputPath)
      console.log('[RUNS_MERGE_RECORDED] mode:', mode, 'resolvedOutputPath:', resolvedOutputPath)

      if (mode === 'discard') {
        try { if (fs.existsSync(resolvedOutputPath)) fs.unlinkSync(resolvedOutputPath) } catch { /* ignore */ }
        return { merged: false }
      }

      if (mode === 'dry') {
        try {
          const result = services.testEditor.parseRecordedOutput(project.rootPath, resolvedOutputPath, document)
          return { newBlocks: result?.newBlocks ?? [] }
        } catch (err) {
          console.error('[RUNS_MERGE_RECORDED dry] error:', err)
          return { newBlocks: [], error: String(err) }
        }
      }

      // append or replace: compute final document
      let finalDoc: TestEditorDocument | null
      if (mode === 'replace') {
        finalDoc = services.testEditor.parseRecordedOutputFull(project.rootPath, resolvedOutputPath, document)
      } else {
        finalDoc = services.testEditor.mergeRecordedOutput(project.rootPath, resolvedOutputPath, document)
      }

      // Clean up the temp codegen output file regardless
      try { if (fs.existsSync(resolvedOutputPath)) fs.unlinkSync(resolvedOutputPath) } catch { /* ignore */ }

      if (!finalDoc) return { merged: false }

      services.testEditor.save(project.rootPath, finalDoc)
      return { merged: true }
    },
  },
  {
    method: 'get',
    path: API_ROUTES.RUNS_GET_RECORDED_SNIPPET,
    tags: ['Runs'],
    summary: 'Get the Playwright-generated snippet from a PWDEBUG=1 pause-record run',
    operationId: 'getRecordedSnippet',
    schemas: { params: runIdParamSchema },
    handler: ({ services, params }) => ({
      snippet: services.run.getRecordedSnippet((params as { runId: string }).runId),
    }),
  },
  {
    method: 'post',
    path: API_ROUTES.RUNS_START_PAUSE_RECORD,
    tags: ['Runs'],
    summary: 'Run existing test steps headlessly, capture browser state, then launch codegen from that state',
    operationId: 'startPauseRecordRun',
    schemas: {
      params: idParamSchema,
      body: z.object({
        document: z.object({}).passthrough(),
        browser: z.string().optional(),
        outputPath: z.string().min(1),
      }),
    },
    handler: async ({ services, params, body }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      const { document, browser, outputPath } = body as {
        document: TestEditorDocument
        browser?: string
        outputPath: string
      }

      const runId = crypto.randomUUID()
      const stateDir = path.join(project.rootPath, '.artifacts', 'pause-record')
      fs.mkdirSync(stateDir, { recursive: true })
      const storageStatePath = path.join(stateDir, `${runId}-state.json`)

      const metaPath = storageStatePath.replace('.json', '-meta.json')

      // Render existing blocks and append storage-state + URL capture inline at the end of the test body
      const snippet = services.testEditor.renderSnippet(project.rootPath, document)
      const lastClose = snippet.lastIndexOf('\n})')
      const captureLines = [
        `  await page.context().storageState({ path: ${JSON.stringify(storageStatePath)} })`,
        `  require('fs').writeFileSync(${JSON.stringify(metaPath)}, JSON.stringify({ url: page.url() }))`,
      ].join('\n')
      const captureSnippet =
        lastClose !== -1
          ? `${snippet.slice(0, lastClose)}\n${captureLines}${snippet.slice(lastClose)}`
          : snippet

      const tempFile = path.join(project.rootPath, `.pw-state-capture-${runId}.spec.ts`)
      const fullSource = `import { test, expect } from '@playwright/test'\n\n${captureSnippet}\n`
      fs.writeFileSync(tempFile, fullSource, 'utf8')

      const configSummary = services.playwrightConfig.get(project.id, project.rootPath)
      const firstProject = configSummary.projects[0]
      const browserSelection: RunRequest['browser'] = firstProject
        ? { mode: 'single', projectName: firstProject }
        : { mode: 'all' }

      const request: RunRequest = {
        projectId: project.id,
        targetPath: tempFile,
        browser: browserSelection,
        headed: false,
        streamLogs: true,
        testDirOverride: project.rootPath,
      }

      try {
        const startedRunId = await services.run.startRun(request, project.rootPath)
        return { runId: startedRunId, tempFile, storageStatePath }
      } catch (error) {
        try { fs.unlinkSync(tempFile) } catch { /* ignore */ }
        if (error instanceof ActiveRunError) {
          throw new ApiRouteError(ERROR_CODES.ACTIVE_RUN_EXISTS, error.message, 409)
        }
        throw error
      }
    },
  },
]
