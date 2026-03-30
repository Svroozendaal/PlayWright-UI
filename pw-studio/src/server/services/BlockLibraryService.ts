import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { ERROR_CODES } from '../../shared/types/ipc'
import type {
  BlockDefinition,
  BlockFieldValue,
  BlockLibraryProjectState,
  BlockTemplate,
  FlowInputMapping,
  ManagedBlockTemplate,
  SelectorSpec,
  TestReferenceSpec,
  TestEditorLibraryPayload,
} from '../../shared/types/ipc'
import { ApiRouteError } from '../middleware/envelope'
import type { PluginRuntimeService } from '../plugins/runtime'
import { resolveUserDataPath } from '../utils/paths'

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

const flowInputMappingSchema = z.object({
  targetName: z.string(),
  source: z.enum(['flow_input', 'literal']),
  value: z.string(),
})

const blockFieldValueSchema: z.ZodType<BlockFieldValue> = z.union([
  z.string(),
  z.boolean(),
  z.number(),
  z.null(),
  selectorSchema,
  testReferenceSchema,
  z.array(flowInputMappingSchema),
])

const displayConfigSchema = z.object({
  label: z.string().min(1),
  detailSource: z.enum(['url', 'value', 'definitions', 'selector.value', 'selector.name', 'test.title', 'code']),
  quoteDetail: z.boolean().optional(),
  hideTitle: z.boolean().optional(),
  separator: z.enum([': ', ' ']).optional(),
})

const customTemplateSchema = z.object({
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

const projectConfigSchema = z.object({
  includedTemplateIds: z.array(z.string()),
})

export class BlockLibraryService {
  constructor(private readonly pluginRuntime: PluginRuntimeService) {}

  getEditorLibrary(rootPath?: string): TestEditorLibraryPayload {
    const templates = this.listManagedTemplates(rootPath)
    const definitions = this.listDefinitions(rootPath)
    const configuredIds = rootPath ? this.readProjectConfig(rootPath)?.includedTemplateIds ?? null : null
    const availableTemplateIds = configuredIds ?? templates.map((template) => template.id)

    return {
      definitions,
      templates,
      availableTemplateIds: availableTemplateIds.filter((templateId, index, source) => {
        return index === source.indexOf(templateId) && templates.some((template) => template.id === templateId)
      }),
      availableTestCases: [],
    }
  }

  getProjectState(rootPath?: string): BlockLibraryProjectState {
    const templates = this.listManagedTemplates(rootPath)
    const definitions = this.listDefinitions(rootPath)
    const configuredIds = rootPath ? this.readProjectConfig(rootPath)?.includedTemplateIds ?? null : null

    return {
      definitions,
      templates,
      includedTemplateIds: configuredIds ?? templates.map((template) => template.id),
      globalTemplatesPath: this.getGlobalTemplatesPath(),
      projectConfigPath: rootPath ? this.getProjectConfigPath(rootPath) : null,
    }
  }

  saveCustomTemplates(templates: BlockTemplate[]): ManagedBlockTemplate[] {
    const result = z.array(customTemplateSchema).safeParse(templates)
    if (!result.success) {
      throw new ApiRouteError(
        ERROR_CODES.INVALID_INPUT,
        result.error.issues.map((issue) => issue.message).join('; '),
        400
      )
    }

    const definitions = this.getDefinitionMap()
    const builtInTemplateIds = new Set(
      this.pluginRuntime.getRegisteredTemplates().map((template) => template.id.trim().toLowerCase())
    )
    const ids = new Set<string>()

    for (const template of result.data) {
      const normalised = template.id.trim().toLowerCase()
      if (ids.has(normalised)) {
        throw new ApiRouteError(
          ERROR_CODES.INVALID_INPUT,
          `Custom block ids must be unique: "${template.id}".`,
          400
        )
      }

      if (builtInTemplateIds.has(normalised)) {
        throw new ApiRouteError(
          ERROR_CODES.INVALID_INPUT,
          `Custom block id conflicts with a built-in block: "${template.id}".`,
          400
        )
      }

      const definition = definitions.get(template.block.kind)
      if (!definition) {
        throw new ApiRouteError(
          ERROR_CODES.INVALID_INPUT,
          `Unknown block kind for template "${template.id}": ${template.block.kind}.`,
          400
        )
      }

      const validationErrors = validateTemplateValues(definition, template.block.values)
      if (validationErrors.length > 0) {
        throw new ApiRouteError(
          ERROR_CODES.INVALID_INPUT,
          validationErrors.map((message) => `${template.id}: ${message}`).join('; '),
          400
        )
      }

      ids.add(normalised)
    }

    const filePath = this.getGlobalTemplatesPath()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf8')
    return this.listManagedTemplates()
  }

  saveProjectState(rootPath: string, includedTemplateIds: string[]): BlockLibraryProjectState {
    const templates = this.listManagedTemplates(rootPath)
    const validIds = new Set(templates.map((template) => template.id))
    const filteredIds = includedTemplateIds.filter((templateId, index, source) => {
      return validIds.has(templateId) && index === source.indexOf(templateId)
    })

    const filePath = this.getProjectConfigPath(rootPath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(
      filePath,
      JSON.stringify({ includedTemplateIds: filteredIds }, null, 2),
      'utf8'
    )

    return this.getProjectState(rootPath)
  }

  private listManagedTemplates(rootPath?: string): ManagedBlockTemplate[] {
    return [
      ...(rootPath
        ? this.pluginRuntime.getRegisteredTemplates(rootPath)
        : this.pluginRuntime.getAllRegisteredTemplates())
        .map((template) => ({ ...template, builtIn: true })),
      ...this.readCustomTemplates(rootPath).map((template) => ({ ...template, builtIn: false })),
    ]
  }

  private listDefinitions(rootPath?: string): BlockDefinition[] {
    const definitions = rootPath
      ? this.pluginRuntime.getAvailableBlockDefinitions(rootPath)
      : this.pluginRuntime.getAllBlockDefinitions()

    return definitions.map((definition) => ({
      kind: definition.kind,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      defaultTitle: definition.defaultTitle,
      builtIn: definition.builtIn,
      pluginId: definition.pluginId,
      fields: definition.fields,
      display: definition.display,
    }))
  }

  private readCustomTemplates(rootPath?: string): BlockTemplate[] {
    const filePath = this.getGlobalTemplatesPath()
    if (!fs.existsSync(filePath)) {
      return []
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      const result = z.array(customTemplateSchema).safeParse(parsed)
      if (!result.success) {
        return []
      }

      const definitions = new Set(this.listDefinitions(rootPath).map((definition) => definition.kind))
      return result.data.filter((template) => definitions.has(template.block.kind))
    } catch {
      return []
    }
  }

  private readProjectConfig(rootPath: string): z.infer<typeof projectConfigSchema> | null {
    const filePath = this.getProjectConfigPath(rootPath)
    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      const result = projectConfigSchema.safeParse(parsed)
      return result.success ? result.data : null
    } catch {
      return null
    }
  }

  private getDefinitionMap(): Map<string, BlockDefinition> {
    return new Map(this.listDefinitions().map((definition) => [definition.kind, definition] as const))
  }

  private getGlobalTemplatesPath(): string {
    return resolveUserDataPath(path.join('block-library', 'templates.json'))
  }

  private getProjectConfigPath(rootPath: string): string {
    return path.join(rootPath, '.pw-studio', 'block-library.json')
  }
}

function validateTemplateValues(
  definition: BlockDefinition,
  values: Record<string, BlockFieldValue>
): string[] {
  const errors: string[] = []
  const allowedKeys = new Set(definition.fields.map((field) => field.key))

  for (const field of definition.fields) {
    const value = values[field.key]
    if (field.required && isEmptyFieldValue(value)) {
      errors.push(`Missing required value for "${field.key}"`)
    }

    if (!isFieldTypeValid(field.type, value)) {
      errors.push(`Invalid value for "${field.key}"`)
    }
  }

  for (const key of Object.keys(values)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown field key "${key}"`)
    }
  }

  return errors
}

function isEmptyFieldValue(value: BlockFieldValue | undefined): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0)
}

function isFieldTypeValid(type: BlockDefinition['fields'][number]['type'], value: BlockFieldValue | undefined): boolean {
  if (value === undefined) {
    return true
  }

  switch (type) {
    case 'text':
    case 'textarea':
    case 'select':
      return typeof value === 'string'
    case 'checkbox':
      return typeof value === 'boolean'
    case 'selector':
      return isSelectorSpec(value)
    case 'test_case':
      return value === null || isTestReferenceSpec(value)
    case 'flow_mapping':
      return Array.isArray(value) && value.every((entry) => isFlowInputMapping(entry))
  }
}

function isSelectorSpec(value: BlockFieldValue): value is SelectorSpec {
  if (!value || typeof value !== 'object') {
    return false
  }

  return 'strategy' in value && 'value' in value
}

function isTestReferenceSpec(value: BlockFieldValue): value is TestReferenceSpec {
  if (!value || typeof value !== 'object') {
    return false
  }

  return 'filePath' in value && 'ordinal' in value && 'testTitle' in value
}

function isFlowInputMapping(value: unknown): value is FlowInputMapping {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    'targetName' in value &&
    'source' in value &&
    'value' in value &&
    typeof (value as FlowInputMapping).targetName === 'string' &&
    ((value as FlowInputMapping).source === 'flow_input' || (value as FlowInputMapping).source === 'literal') &&
    typeof (value as FlowInputMapping).value === 'string'
  )
}
