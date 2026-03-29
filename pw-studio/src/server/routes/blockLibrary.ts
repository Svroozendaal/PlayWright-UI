import { z } from 'zod'
import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema } from './common'

const selectorSchema = z.object({
  strategy: z.enum(['role', 'text', 'label', 'test_id', 'css']),
  value: z.string(),
  name: z.string().optional(),
})

const testReferenceSchema = z.object({
  filePath: z.string(),
  ordinal: z.number().int().nonnegative(),
  testTitle: z.string(),
})

const blockFieldValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.number(),
  z.null(),
  selectorSchema,
  testReferenceSchema,
])

const displayConfigSchema = z.object({
  label: z.string().min(1),
  detailSource: z.enum(['url', 'value', 'selector.value', 'selector.name', 'test.title', 'code']),
  quoteDetail: z.boolean().optional(),
  hideTitle: z.boolean().optional(),
  separator: z.enum([': ', ' ']).optional(),
})

const blockTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.string().min(1),
  pluginId: z.string().min(1).optional(),
  display: displayConfigSchema.optional(),
  block: z.object({
    kind: z.string().min(1),
    values: z.record(z.string(), blockFieldValueSchema),
  }),
})

const saveTemplatesBodySchema = z.object({
  templates: z.array(blockTemplateSchema),
})

const saveProjectBodySchema = z.object({
  includedTemplateIds: z.array(z.string()),
})

export const blockLibraryRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.BLOCK_LIBRARY_TEMPLATES,
    tags: ['Block Library'],
    summary: 'List managed block library templates',
    operationId: 'listBlockLibraryTemplates',
    handler: ({ services }) => services.blockLibrary.getProjectState(),
  },
  {
    method: 'put',
    path: API_ROUTES.BLOCK_LIBRARY_TEMPLATES,
    tags: ['Block Library'],
    summary: 'Persist custom block library templates',
    operationId: 'saveBlockLibraryTemplates',
    schemas: { body: saveTemplatesBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof saveTemplatesBodySchema>
      services.blockLibrary.saveCustomTemplates(payload.templates)
      return services.blockLibrary.getProjectState()
    },
  },
  {
    method: 'get',
    path: API_ROUTES.BLOCK_LIBRARY_PROJECT,
    tags: ['Block Library'],
    summary: 'Get block library availability for a project',
    operationId: 'getProjectBlockLibrary',
    schemas: { params: idParamSchema },
    handler: ({ services, params }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      return services.blockLibrary.getProjectState(project.rootPath)
    },
  },
  {
    method: 'put',
    path: API_ROUTES.BLOCK_LIBRARY_PROJECT,
    tags: ['Block Library'],
    summary: 'Save block library availability for a project',
    operationId: 'saveProjectBlockLibrary',
    schemas: {
      params: idParamSchema,
      body: saveProjectBodySchema,
    },
    handler: ({ services, params, body }) => {
      const project = getProjectOrThrow(services, (params as { id: string }).id)
      const payload = body as z.infer<typeof saveProjectBodySchema>
      return services.blockLibrary.saveProjectState(project.rootPath, payload.includedTemplateIds)
    },
  },
]
