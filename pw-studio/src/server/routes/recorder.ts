import { z } from 'zod'
import { API_ROUTES, ERROR_CODES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { ApiRouteError } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema } from './common'
import { RecorderAlreadyRunningError } from '../services/RecorderService'

const recorderStartBodySchema = z.object({
  startUrl: z.string().optional(),
  outputPath: z.string().min(1),
  browser: z.string().optional(),
})

const recorderSaveBodySchema = z.object({
  outputPath: z.string().min(1),
})

export const recorderRoutes: RouteDefinition[] = [
  {
    method: 'post',
    path: API_ROUTES.RECORDER_START,
    tags: ['Recorder'],
    summary: 'Start Playwright codegen for a project',
    operationId: 'startRecorder',
    schemas: {
      params: idParamSchema,
      body: recorderStartBodySchema,
    },
    handler: ({ services, params, body }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      const payload = body as z.infer<typeof recorderStartBodySchema>
      try {
        services.recorder.start(project.rootPath, payload)
      } catch (error) {
        if (error instanceof RecorderAlreadyRunningError) {
          throw new ApiRouteError(ERROR_CODES.RECORDER_ALREADY_RUNNING, error.message, 409)
        }
        throw error
      }
      return undefined
    },
  },
  {
    method: 'post',
    path: API_ROUTES.RECORDER_STOP,
    tags: ['Recorder'],
    summary: 'Stop Playwright codegen',
    operationId: 'stopRecorder',
    handler: ({ services }) => {
      services.recorder.stop()
      return undefined
    },
  },
  {
    method: 'get',
    path: API_ROUTES.RECORDER_STATUS,
    tags: ['Recorder'],
    summary: 'Get current recorder status',
    operationId: 'getRecorderStatus',
    handler: ({ services }) => services.recorder.getStatus(),
  },
  {
    method: 'post',
    path: API_ROUTES.RECORDER_SAVE,
    tags: ['Recorder'],
    summary: 'Check whether the generated recorder file exists',
    operationId: 'getRecorderOutputFile',
    schemas: { body: recorderSaveBodySchema },
    handler: ({ services, body }) => services.recorder.getOutputFile((body as { outputPath: string }).outputPath),
  },
]
