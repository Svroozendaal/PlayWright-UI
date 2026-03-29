import type { Request, Response } from 'express'
import { z } from 'zod'
import type { ServiceContainer } from '../services/ServiceContainer'
import { ERROR_CODES } from '../../shared/types/ipc'

export const apiEnvelopeSchema = z.object({
  version: z.literal(1),
  payload: z.any().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
})

const errorStatusMap: Record<string, number> = {
  [ERROR_CODES.INVALID_INPUT]: 400,
  [ERROR_CODES.INVALID_PATH]: 400,
  [ERROR_CODES.TEST_CASE_NOT_FOUND]: 404,
  [ERROR_CODES.PROJECT_NOT_FOUND]: 404,
  [ERROR_CODES.RUN_NOT_FOUND]: 404,
  [ERROR_CODES.ENVIRONMENT_NOT_FOUND]: 404,
  [ERROR_CODES.PROJECT_EXISTS]: 409,
  [ERROR_CODES.ACTIVE_RUN_EXISTS]: 409,
  [ERROR_CODES.RECORDER_ALREADY_RUNNING]: 409,
  [ERROR_CODES.SECRETS_UNAVAILABLE]: 503,
  [ERROR_CODES.SERVER_UNAVAILABLE]: 503,
  [ERROR_CODES.HEALTH_CHECK_FAILED]: 500,
  [ERROR_CODES.CONFIG_NOT_READABLE]: 500,
  [ERROR_CODES.UNKNOWN]: 500,
}

export type RouteSchemas = {
  params?: z.ZodTypeAny
  query?: z.ZodTypeAny
  body?: z.ZodTypeAny
  response?: z.ZodTypeAny
}

export type RouteContext<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> = {
  req: Request
  res: Response
  services: ServiceContainer
  params: TParams
  query: TQuery
  body: TBody
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export type RouteDefinition = {
  method: HttpMethod
  path: string
  tags: string[]
  summary: string
  description?: string
  operationId: string
  schemas?: RouteSchemas
  handler: (context: RouteContext) => Promise<unknown> | unknown
}

/**
 * Error used by route handlers to return a typed API envelope error.
 */
export class ApiRouteError extends Error {
  code: string

  status: number

  /**
   * Create a typed API route error.
   *
   * Params:
   * code - Stable shared error code.
   * message - Human-readable error message.
   * status - Optional HTTP status override.
   */
  constructor(code: string, message: string, status?: number) {
    super(message)
    this.name = 'ApiRouteError'
    this.code = code
    this.status = status ?? errorStatusMap[code] ?? 500
  }
}

/**
 * Register a single route definition on an Express router or app instance.
 *
 * Params:
 * target - Express router or app.
 * services - Shared service container.
 * route - Route definition with schemas and handler.
 */
export function registerRoute(
  target: {
    [K in HttpMethod]: (
      path: string,
      handler: (req: Request, res: Response) => Promise<void> | void
    ) => unknown
  },
  services: ServiceContainer,
  route: RouteDefinition
): void {
  target[route.method](route.path, async (req, res) => {
    try {
      const params = route.schemas?.params ? route.schemas.params.parse(req.params) : req.params
      const query = route.schemas?.query ? route.schemas.query.parse(req.query) : req.query
      const body = route.schemas?.body ? route.schemas.body.parse(req.body) : req.body

      const result = await route.handler({
        req,
        res,
        services,
        params,
        query,
        body,
      })

      const payload = route.schemas?.response ? route.schemas.response.parse(result) : result
      res.status(200).json(payload === undefined ? { version: 1 } : { version: 1, payload })
    } catch (error) {
      respondWithError(res, error)
    }
  })
}

/**
 * Convert any thrown error into the shared envelope format.
 *
 * Params:
 * res - Express response object.
 * error - Thrown error value.
 */
export function respondWithError(res: Response, error: unknown): void {
  if (error instanceof ApiRouteError) {
    res.status(error.status).json({
      version: 1,
      error: {
        code: error.code,
        message: error.message,
      },
    })
    return
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({
      version: 1,
      error: {
        code: ERROR_CODES.INVALID_INPUT,
        message: error.issues.map((issue) => issue.message).join('; '),
      },
    })
    return
  }

  res.status(500).json({
    version: 1,
    error: {
      code: ERROR_CODES.UNKNOWN,
      message: error instanceof Error ? error.message : String(error),
    },
  })
}
