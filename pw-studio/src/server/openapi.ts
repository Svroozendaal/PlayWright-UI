import type { OpenAPIObject } from 'openapi3-ts/oas30'
import { OpenApiGeneratorV3, OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import type { RouteDefinition } from './middleware/envelope'
import { registerOpenApiRoute } from './routes/registry'

extendZodWithOpenApi(z)

/**
 * Build the OpenAPI document from the shared route definitions.
 *
 * Params:
 * routes - Route definitions used at runtime.
 *
 * Returns:
 * OpenAPI document object.
 */
export function buildOpenApiDocument(routes: RouteDefinition[]): OpenAPIObject {
  const registry = new OpenAPIRegistry()

  for (const route of routes) {
    registerOpenApiRoute(registry, route)
  }

  const generator = new OpenApiGeneratorV3(registry.definitions)

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'PW Studio Local API',
      version: '1.0.0',
      description: 'Local REST API and WebSocket companion contract for PW Studio.',
    },
    servers: [
      {
        url: '/api',
      },
    ],
  })
}
