import { z } from 'zod'
import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema } from './common'

const projectPluginParamsSchema = idParamSchema.extend({
  pluginId: z.string().min(1),
})

const updateProjectPluginBodySchema = z.object({
  enabled: z.boolean(),
})

export const pluginRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.PLUGINS_LIST,
    tags: ['Plugins'],
    summary: 'List installed PW Studio plugins',
    operationId: 'listPlugins',
    handler: ({ services }) => ({
      plugins: services.pluginRuntime.listPlugins(),
    }),
  },
  {
    method: 'get',
    path: API_ROUTES.PROJECT_PLUGINS_LIST,
    tags: ['Plugins'],
    summary: 'List plugin enablement for a project',
    operationId: 'listProjectPlugins',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      return services.pluginRuntime.listProjectPlugins(project.rootPath)
    },
  },
  {
    method: 'put',
    path: API_ROUTES.PROJECT_PLUGIN_UPDATE,
    tags: ['Plugins'],
    summary: 'Enable or disable a plugin for a project',
    operationId: 'updateProjectPlugin',
    schemas: {
      params: projectPluginParamsSchema,
      body: updateProjectPluginBodySchema,
    },
    handler: async ({ services, params, body }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      const { pluginId } = params as z.infer<typeof projectPluginParamsSchema>
      const payload = body as z.infer<typeof updateProjectPluginBodySchema>
      return services.pluginRuntime.updateProjectPlugin(project.rootPath, pluginId, payload.enabled)
    },
  },
]
