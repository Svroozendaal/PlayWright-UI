import { z } from 'zod'
import { API_ROUTES, ERROR_CODES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { ApiRouteError } from '../middleware/envelope'
import { getProjectOrThrow } from './common'
import { SecretsUnavailableError } from '../services/SecretsService'

const setSecretBodySchema = z.object({
  projectId: z.string().min(1),
  envName: z.string().min(1),
  key: z.string().min(1),
  value: z.string().min(1),
})

const getMaskedQuerySchema = z.object({
  projectId: z.string().min(1),
  envName: z.string().min(1),
})

const deleteSecretBodySchema = z.object({
  projectId: z.string().min(1),
  envName: z.string().min(1),
  key: z.string().min(1),
})

export const secretRoutes: RouteDefinition[] = [
  {
    method: 'post',
    path: API_ROUTES.SECRETS_SET,
    tags: ['Secrets'],
    summary: 'Set a secret in the OS keychain',
    operationId: 'setSecret',
    schemas: { body: setSecretBodySchema },
    handler: async ({ services, body }) => {
      const payload = body as z.infer<typeof setSecretBodySchema>
      try {
        await services.secrets.setSecret(payload.projectId, payload.envName, payload.key, payload.value)
        return undefined
      } catch (error) {
        if (error instanceof SecretsUnavailableError) {
          throw new ApiRouteError(ERROR_CODES.SECRETS_UNAVAILABLE, error.message, 503)
        }
        throw error
      }
    },
  },
  {
    method: 'get',
    path: API_ROUTES.SECRETS_GET_MASKED,
    tags: ['Secrets'],
    summary: 'Get masked secret references for an environment',
    operationId: 'getMaskedSecrets',
    schemas: { query: getMaskedQuerySchema },
    handler: ({ services, query }) => {
      const payload = query as z.infer<typeof getMaskedQuerySchema>
      const project = getProjectOrThrow(services, payload.projectId)
      const environments = services.environment.listEnvironments(project.id, project.rootPath)
      const environment = environments.find((entry) => entry.name === payload.envName)

      if (!environment) {
        return []
      }

      return Object.keys(environment.secretRefs).map((key) => ({
        key,
        masked: '****',
      }))
    },
  },
  {
    method: 'delete',
    path: API_ROUTES.SECRETS_DELETE,
    tags: ['Secrets'],
    summary: 'Delete a secret from the OS keychain',
    operationId: 'deleteSecret',
    schemas: { body: deleteSecretBodySchema },
    handler: async ({ services, body }) => {
      const payload = body as z.infer<typeof deleteSecretBodySchema>
      try {
        await services.secrets.deleteSecret(payload.projectId, payload.envName, payload.key)
        return undefined
      } catch (error) {
        if (error instanceof SecretsUnavailableError) {
          throw new ApiRouteError(ERROR_CODES.SECRETS_UNAVAILABLE, error.message, 503)
        }
        throw error
      }
    },
  },
]
