import { z } from 'zod'
import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getProjectOrThrow, idParamSchema } from './common'

const selectorSchema = z.object({
  strategy: z.enum(['role', 'text', 'label', 'test_id', 'css']),
  value: z.string(),
  name: z.string().optional(),
})

const displayConfigSchema = z.object({
  label: z.string().min(1),
  detailSource: z.enum(['url', 'value', 'selector.value', 'selector.name', 'code']),
  quoteDetail: z.boolean().optional(),
  hideTitle: z.boolean().optional(),
  separator: z.enum([': ', ' ']).optional(),
})

const blockTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.string().min(1),
  display: displayConfigSchema.optional(),
  block: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('raw_code'),
      code: z.string(),
    }),
    z.object({
      kind: z.literal('goto_url'),
      url: z.string(),
    }),
    z.object({
      kind: z.literal('click_element'),
      selector: selectorSchema,
    }),
    z.object({
      kind: z.literal('fill_field'),
      selector: selectorSchema,
      value: z.string(),
    }),
    z.object({
      kind: z.literal('expect_url'),
      url: z.string(),
    }),
  ]),
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
