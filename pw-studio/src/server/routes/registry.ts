import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import type { RouteDefinition } from '../middleware/envelope'
import { apiEnvelopeSchema } from '../middleware/envelope'

/**
 * Convert an Express path template into an OpenAPI path template.
 *
 * Params:
 * pathTemplate - Express path such as `/projects/:id`.
 *
 * Returns:
 * OpenAPI path such as `/projects/{id}`.
 */
function toOpenApiPath(pathTemplate: string): string {
  return pathTemplate.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

/**
 * Register route metadata in the OpenAPI registry using the same route
 * definitions that drive runtime registration.
 *
 * Params:
 * registry - OpenAPI registry instance.
 * route - Runtime route definition.
 */
export function registerOpenApiRoute(
  registry: OpenAPIRegistry,
  route: RouteDefinition
): void {
  const paramsSchema = route.schemas?.params as z.ZodObject<z.ZodRawShape> | undefined
  const querySchema = route.schemas?.query as z.ZodObject<z.ZodRawShape> | undefined
  const bodySchema = route.schemas?.body as z.ZodTypeAny | undefined

  registry.registerPath({
    method: route.method,
    path: toOpenApiPath(route.path),
    operationId: route.operationId,
    tags: route.tags,
    summary: route.summary,
    description: route.description,
    request: {
      params: paramsSchema,
      query: querySchema,
      body: bodySchema
        ? {
            content: {
              'application/json': {
                schema: bodySchema,
              },
            },
          }
        : undefined,
    },
    responses: {
      200: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: apiEnvelopeSchema,
          },
        },
      },
      400: {
        description: 'Invalid input',
        content: {
          'application/json': {
            schema: apiEnvelopeSchema,
          },
        },
      },
      500: {
        description: 'Unexpected error',
        content: {
          'application/json': {
            schema: apiEnvelopeSchema,
          },
        },
      },
    },
  })
}
