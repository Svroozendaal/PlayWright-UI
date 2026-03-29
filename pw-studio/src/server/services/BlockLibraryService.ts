import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { ERROR_CODES } from '../../shared/types/ipc'
import type {
  BlockLibraryProjectState,
  BlockTemplate,
  ManagedBlockTemplate,
  SelectorSpec,
  TestEditorLibraryPayload,
} from '../../shared/types/ipc'
import { ApiRouteError } from '../middleware/envelope'
import { resolveUserDataPath } from '../utils/paths'

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

const customTemplateSchema = z.object({
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

const projectConfigSchema = z.object({
  includedTemplateIds: z.array(z.string()),
})

export class BlockLibraryService {
  getEditorLibrary(rootPath?: string): TestEditorLibraryPayload {
    const templates = this.listManagedTemplates()
    const configuredIds = rootPath ? this.readProjectConfig(rootPath)?.includedTemplateIds ?? null : null
    const availableTemplateIds = configuredIds ?? templates.map((template) => template.id)

    return {
      templates,
      availableTemplateIds: availableTemplateIds.filter((templateId, index, source) => {
        return index === source.indexOf(templateId) && templates.some((template) => template.id === templateId)
      }),
    }
  }

  getProjectState(rootPath?: string): BlockLibraryProjectState {
    const templates = this.listManagedTemplates()
    const configuredIds = rootPath ? this.readProjectConfig(rootPath)?.includedTemplateIds ?? null : null

    return {
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

      ids.add(normalised)
    }

    const filePath = this.getGlobalTemplatesPath()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf8')
    return this.listManagedTemplates()
  }

  saveProjectState(rootPath: string, includedTemplateIds: string[]): BlockLibraryProjectState {
    const templates = this.listManagedTemplates()
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

  private listManagedTemplates(): ManagedBlockTemplate[] {
    return [
      ...builtInTemplates.map((template) => ({ ...template, builtIn: true })),
      ...this.readCustomTemplates().map((template) => ({ ...template, builtIn: false })),
    ]
  }

  private readCustomTemplates(): BlockTemplate[] {
    const filePath = this.getGlobalTemplatesPath()
    if (!fs.existsSync(filePath)) {
      return []
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      const result = z.array(customTemplateSchema).safeParse(parsed)
      return result.success ? result.data : []
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

  private getGlobalTemplatesPath(): string {
    return resolveUserDataPath(path.join('block-library', 'templates.json'))
  }

  private getProjectConfigPath(rootPath: string): string {
    return path.join(rootPath, '.pw-studio', 'block-library.json')
  }
}

const builtInTemplates: BlockTemplate[] = [
  {
    id: 'goto-url',
    name: 'Go to URL',
    description: 'Navigate the page to a specific URL.',
    category: 'Navigation',
    display: {
      label: 'Go to URL',
      detailSource: 'url',
      separator: ': ',
    },
    block: {
      kind: 'goto_url',
      url: 'https://example.com/',
    },
  },
  {
    id: 'click-link',
    name: 'Click element',
    description: 'Click a page element by role, text, label, test id, or CSS selector.',
    category: 'Actions',
    display: {
      label: 'Click element',
      detailSource: 'selector.name',
      quoteDetail: true,
      separator: ' ',
    },
    block: {
      kind: 'click_element',
      selector: createRoleSelector('link', 'Example'),
    },
  },
  {
    id: 'fill-field',
    name: 'Fill field',
    description: 'Fill an input field through a supported selector strategy.',
    category: 'Actions',
    display: {
      label: 'Fill field',
      detailSource: 'selector.value',
      quoteDetail: true,
      separator: ': ',
    },
    block: {
      kind: 'fill_field',
      selector: createTextSelector('Email'),
      value: 'user@example.com',
    },
  },
  {
    id: 'expect-url',
    name: 'Expect URL',
    description: 'Assert that the browser is currently on a specific URL.',
    category: 'Assertions',
    display: {
      label: 'Expect URL',
      detailSource: 'url',
      separator: ': ',
    },
    block: {
      kind: 'expect_url',
      url: 'https://example.com/dashboard',
    },
  },
  {
    id: 'raw-code',
    name: 'Raw code',
    description: 'Insert plain Playwright or TypeScript statements when no visual block exists yet.',
    category: 'Advanced',
    display: {
      label: 'Raw code',
      detailSource: 'code',
    },
    block: {
      kind: 'raw_code',
      code: "await expect(page.getByText('Done')).toBeVisible();",
    },
  },
]

const builtInTemplateIds = new Set(builtInTemplates.map((template) => template.id.toLowerCase()))

function createRoleSelector(role: string, name: string): SelectorSpec {
  return {
    strategy: 'role',
    value: role,
    name,
  }
}

function createTextSelector(value: string): SelectorSpec {
  return {
    strategy: 'text',
    value,
  }
}
