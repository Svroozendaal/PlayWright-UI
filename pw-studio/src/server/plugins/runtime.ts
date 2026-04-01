import fs from 'fs'
import path from 'path'
import type ts from 'typescript'
import type {
  BlockDefinition,
  BlockTemplate,
  CodegenExtraction,
  CodegenSuggestion,
  FlowInputDefinition,
  LoadedPluginSummary,
  PluginUiContributions,
  ProjectPluginList,
  ProjectPluginState,
  TestBlock,
  TestCaseRef,
} from '../../shared/types/ipc'

export type RecorderTransformInput = {
  rootPath: string
  outputPath: string
  content: string
  startUrl?: string
  browser?: string
}

export type RecorderTransformOutput = {
  content: string
  testTitle?: string
  appliedChanges?: string[]
  extractions?: CodegenExtraction[]
  suggestions?: CodegenSuggestion[]
}

export type RecorderTransform = {
  id: string
  name: string
  pluginId?: string
  transform: (input: RecorderTransformInput) => RecorderTransformOutput
}

export type ServerBlockContext = {
  rootPath?: string
  documentFilePath?: string
  documentTestCaseRef?: TestCaseRef
  flowInputAccessor?: string
  flowInputs?: FlowInputDefinition[]
  constants?: string[]
  availableEnvVarNames?: string[]
}

export type ServerBlockDefinition = BlockDefinition & {
  parseLeadingStatements?: (
    statements: readonly ts.Statement[],
    sourceFile: ts.SourceFile
  ) => { block: TestBlock; consumedCount: number; locatorConstantNodes?: Map<string, ts.Node> } | null
  parseStatement?: (
    statement: ts.Statement,
    title: string | null,
    constants?: string[],
    locatorConstantNodes?: Map<string, ts.Node>
  ) => TestBlock | null
  render: (block: TestBlock, context: ServerBlockContext) => string
  validate?: (block: TestBlock, context: ServerBlockContext) => string[]
}

type ProjectPluginConfig = {
  enabled: boolean
  config?: Record<string, unknown>
}

export type ProjectSetupHandler = {
  onEnable?: (rootPath: string) => void | Promise<void>
  onDisable?: (rootPath: string) => void | Promise<void>
}

export class PluginProjectService {
  listEnabledPluginIds(rootPath: string, manifests: LoadedPluginSummary[]): string[] {
    return manifests
      .filter((manifest) => this.readProjectConfig(rootPath, manifest.id).enabled)
      .map((manifest) => manifest.id)
  }

  listProjectPlugins(rootPath: string, manifests: LoadedPluginSummary[]): ProjectPluginList {
    const plugins = manifests.map((manifest) => ({
      pluginId: manifest.id,
      enabled: this.readProjectConfig(rootPath, manifest.id).enabled,
      configPath: this.getProjectConfigPath(rootPath, manifest.id),
      manifest,
    }))

    return { plugins }
  }

  updateProjectPlugin(rootPath: string, pluginId: string, enabled: boolean): ProjectPluginState {
    const current = this.readProjectConfig(rootPath, pluginId)
    const configPath = this.getProjectConfigPath(rootPath, pluginId)
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(
      configPath,
      JSON.stringify({ enabled, config: current.config }, null, 2),
      'utf8'
    )

    return {
      pluginId,
      enabled,
      configPath,
      manifest: {
        id: pluginId,
        name: pluginId,
        version: 'unknown',
        capabilities: [],
        status: 'loaded',
      },
    }
  }

  getProjectConfigPath(rootPath: string, pluginId: string): string {
    return path.join(rootPath, '.pw-studio', 'plugins', `${pluginId}.json`)
  }

  getProjectConfig(rootPath: string, pluginId: string): Record<string, unknown> | undefined {
    return this.readProjectConfig(rootPath, pluginId).config
  }

  saveProjectConfig(rootPath: string, pluginId: string, config: Record<string, unknown>): void {
    const current = this.readProjectConfig(rootPath, pluginId)
    const configPath = this.getProjectConfigPath(rootPath, pluginId)
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(
      configPath,
      JSON.stringify({ enabled: current.enabled, config }, null, 2),
      'utf8'
    )
  }

  private readProjectConfig(rootPath: string, pluginId: string): ProjectPluginConfig {
    const configPath = this.getProjectConfigPath(rootPath, pluginId)
    if (!fs.existsSync(configPath)) {
      return { enabled: false }
    }

    try {
      const raw = fs.readFileSync(configPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<ProjectPluginConfig>
      return {
        enabled: parsed.enabled === true,
        config: parsed.config && typeof parsed.config === 'object' ? parsed.config : undefined,
      }
    } catch {
      return { enabled: false }
    }
  }
}

export class PluginRuntimeService {
  private readonly blockDefinitions = new Map<string, ServerBlockDefinition>()

  private readonly recorderTransforms: RecorderTransform[] = []

  private readonly blockTemplates: BlockTemplate[] = []

  private readonly pluginUi = new Map<string, PluginUiContributions>()

  private readonly projectSetupHandlers = new Map<string, ProjectSetupHandler>()

  private loadedPlugins: LoadedPluginSummary[] = []

  constructor(private readonly projectPlugins: PluginProjectService) {}

  registerBlockDefinition(definition: ServerBlockDefinition): void {
    this.blockDefinitions.set(definition.kind, definition)
  }

  registerRecorderTransform(transform: RecorderTransform): void {
    this.recorderTransforms.push(transform)
  }

  registerBlockTemplate(template: BlockTemplate): void {
    this.blockTemplates.push(template)
  }

  registerUi(pluginId: string, ui: PluginUiContributions): void {
    this.pluginUi.set(pluginId, ui)
  }

  registerProjectSetup(pluginId: string, handler: ProjectSetupHandler): void {
    this.projectSetupHandlers.set(pluginId, handler)
  }

  getAllBlockDefinitions(): ServerBlockDefinition[] {
    return [...this.blockDefinitions.values()]
  }

  getAvailableBlockDefinitions(rootPath?: string): ServerBlockDefinition[] {
    const enabled = rootPath ? new Set(this.getEnabledPluginIds(rootPath)) : null
    return this.getAllBlockDefinitions().filter((definition) => {
      if (!definition.pluginId) {
        return true
      }
      return enabled ? enabled.has(definition.pluginId) : false
    })
  }

  getRegisteredTemplates(rootPath?: string): BlockTemplate[] {
    const enabled = rootPath ? new Set(this.getEnabledPluginIds(rootPath)) : null
    return this.blockTemplates.filter((template) => {
      if (!template.pluginId) {
        return true
      }
      return enabled ? enabled.has(template.pluginId) : false
    })
  }

  getAllRegisteredTemplates(): BlockTemplate[] {
    return [...this.blockTemplates]
  }

  applyRecorderTransforms(input: RecorderTransformInput): RecorderTransformOutput {
    const enabled = new Set(this.getEnabledPluginIds(input.rootPath))
    let content = input.content
    let testTitle: string | undefined
    const appliedChanges: string[] = []
    const extractions: CodegenExtraction[] = []
    const suggestions: CodegenSuggestion[] = []

    for (const transform of this.recorderTransforms) {
      if (transform.pluginId && !enabled.has(transform.pluginId)) {
        continue
      }

      const result = transform.transform({
        ...input,
        content,
      })

      content = result.content
      if (result.testTitle) {
        testTitle = result.testTitle
      }
      appliedChanges.push(...(result.appliedChanges ?? []))
      extractions.push(...(result.extractions ?? []))
      suggestions.push(...(result.suggestions ?? []))
    }

    return {
      content,
      testTitle,
      appliedChanges,
      extractions,
      suggestions,
    }
  }

  setLoadedPlugins(plugins: LoadedPluginSummary[]): void {
    this.loadedPlugins = plugins.map((plugin) => ({
      ...plugin,
      ui: plugin.ui ?? this.pluginUi.get(plugin.id) ?? { pages: [], panels: [] },
    }))
  }

  listPlugins(): LoadedPluginSummary[] {
    return this.loadedPlugins
  }

  listProjectPlugins(rootPath: string): ProjectPluginList {
    const projectPlugins = this.projectPlugins.listProjectPlugins(rootPath, this.loadedPlugins)
    return {
      plugins: projectPlugins.plugins.map((plugin) => ({
        ...plugin,
        manifest: this.loadedPlugins.find((entry) => entry.id === plugin.pluginId) ?? plugin.manifest,
      })),
    }
  }

  async updateProjectPlugin(rootPath: string, pluginId: string, enabled: boolean): Promise<ProjectPluginState> {
    const saved = this.projectPlugins.updateProjectPlugin(rootPath, pluginId, enabled)
    const handler = this.projectSetupHandlers.get(pluginId)
    if (enabled) {
      await handler?.onEnable?.(rootPath)
    } else {
      await handler?.onDisable?.(rootPath)
    }
    return {
      ...saved,
      manifest:
        this.loadedPlugins.find((plugin) => plugin.id === pluginId) ??
        saved.manifest,
    }
  }

  getEnabledPluginIds(rootPath: string): string[] {
    return this.projectPlugins.listEnabledPluginIds(rootPath, this.loadedPlugins)
  }

  getProjectPluginConfig(rootPath: string, pluginId: string): Record<string, unknown> | undefined {
    return this.projectPlugins.getProjectConfig(rootPath, pluginId)
  }

  saveProjectPluginConfig(rootPath: string, pluginId: string, config: Record<string, unknown>): void {
    this.projectPlugins.saveProjectConfig(rootPath, pluginId, config)
  }
}
