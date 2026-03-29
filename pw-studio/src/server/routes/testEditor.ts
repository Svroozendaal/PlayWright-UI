import { z } from 'zod'
import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getProjectOrThrow } from './common'

const testCaseRefSchema = z.object({
  ordinal: z.number().int().nonnegative(),
  testTitle: z.string(),
})

const selectorSpecSchema = z.object({
  strategy: z.enum(['role', 'text', 'label', 'test_id', 'css']),
  value: z.string(),
  name: z.string().optional(),
})

const testBlockSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('raw_code'),
    code: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('goto_url'),
    url: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('click_element'),
    selector: selectorSpecSchema,
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('fill_field'),
    selector: selectorSpecSchema,
    value: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('expect_url'),
    url: z.string(),
  }),
])

const templateSchema = z.object({
  callee: z.string().min(1),
  extraArgs: z.array(z.string()),
  callbackStyle: z.enum(['arrow', 'function']),
  callbackParams: z.string(),
  callbackAsync: z.boolean(),
})

const editorDocumentSchema = z.object({
  mode: z.enum(['existing', 'create']),
  filePath: z.string().min(1),
  testTitle: z.string(),
  blocks: z.array(testBlockSchema),
  code: z.string(),
  warnings: z.array(z.string()),
  template: templateSchema,
  testCaseRef: testCaseRefSchema.optional(),
})

const loadEditorBodySchema = z.discriminatedUnion('mode', [
  z.object({
    projectId: z.string().min(1),
    filePath: z.string().min(1),
    mode: z.literal('existing'),
    testCaseRef: testCaseRefSchema,
  }),
  z.object({
    projectId: z.string().min(1),
    filePath: z.string().min(1),
    mode: z.literal('create'),
  }),
])

const syncEditorBodySchema = z.discriminatedUnion('mode', [
  z.object({
    projectId: z.string().min(1),
    filePath: z.string().min(1),
    mode: z.literal('existing'),
    code: z.string(),
    testCaseRef: testCaseRefSchema,
  }),
  z.object({
    projectId: z.string().min(1),
    filePath: z.string().min(1),
    mode: z.literal('create'),
    code: z.string(),
  }),
])

const saveEditorBodySchema = z.object({
  projectId: z.string().min(1),
  document: editorDocumentSchema,
})

const libraryQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
})

export const testEditorRoutes: RouteDefinition[] = [
  {
    method: 'post',
    path: API_ROUTES.TEST_EDITOR_LOAD,
    tags: ['Test Editor'],
    summary: 'Load a visual test editor document for an existing or new test',
    operationId: 'loadTestEditorDocument',
    schemas: { body: loadEditorBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof loadEditorBodySchema>
      const project = getProjectOrThrow(services, payload.projectId)

      if (payload.mode === 'existing') {
        return services.testEditor.loadExisting(project.rootPath, payload.filePath, payload.testCaseRef)
      }

      return services.testEditor.createDraft(project.rootPath, payload.filePath)
    },
  },
  {
    method: 'post',
    path: API_ROUTES.TEST_EDITOR_SYNC_CODE,
    tags: ['Test Editor'],
    summary: 'Convert edited test code into the canonical visual editor document',
    operationId: 'syncTestEditorCode',
    schemas: { body: syncEditorBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof syncEditorBodySchema>
      getProjectOrThrow(services, payload.projectId)

      return services.testEditor.syncCode(
        payload.filePath,
        payload.mode,
        payload.code,
        payload.mode === 'existing' ? payload.testCaseRef : undefined
      )
    },
  },
  {
    method: 'post',
    path: API_ROUTES.TEST_EDITOR_SAVE,
    tags: ['Test Editor'],
    summary: 'Persist a visual test editor document back into the source file',
    operationId: 'saveTestEditorDocument',
    schemas: { body: saveEditorBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof saveEditorBodySchema>
      const project = getProjectOrThrow(services, payload.projectId)
      return services.testEditor.save(project.rootPath, payload.document)
    },
  },
  {
    method: 'get',
    path: API_ROUTES.TEST_EDITOR_LIBRARY,
    tags: ['Test Editor'],
    summary: 'List built-in and custom visual test editor block templates',
    operationId: 'listTestEditorLibrary',
    schemas: { query: libraryQuerySchema },
    handler: ({ services, query }) => {
      const projectId = (query as z.infer<typeof libraryQuerySchema>).projectId
      if (!projectId) {
        return services.testEditor.getLibraryTemplates()
      }

      const project = getProjectOrThrow(services, projectId)
      return services.testEditor.getLibraryTemplates(project.rootPath)
    },
  },
]
