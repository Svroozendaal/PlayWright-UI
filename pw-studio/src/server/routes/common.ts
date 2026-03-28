import { z } from 'zod'
import { ERROR_CODES, type RegisteredProject } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'
import { ApiRouteError } from '../middleware/envelope'

export const idParamSchema = z.object({
  id: z.string().min(1),
})

export const runIdParamSchema = z.object({
  runId: z.string().min(1),
})

export const envIdParamSchema = z.object({
  envId: z.string().min(1),
})

/**
 * Resolve a registered project or throw a typed API error.
 *
 * Params:
 * services - Shared service container.
 * projectId - Project identifier.
 *
 * Returns:
 * Registered project record.
 */
export function getProjectOrThrow(
  services: ServiceContainer,
  projectId: string
): RegisteredProject {
  const project = services.projectRegistry.getProject(projectId)

  if (!project) {
    throw new ApiRouteError(
      ERROR_CODES.PROJECT_NOT_FOUND,
      `Project not found: ${projectId}`,
      404
    )
  }

  return project
}

/**
 * Throw a stable API error when a run record cannot be found.
 *
 * Params:
 * runId - Run identifier.
 */
export function throwRunNotFound(runId: string): never {
  throw new ApiRouteError(ERROR_CODES.RUN_NOT_FOUND, `Run not found: ${runId}`, 404)
}
