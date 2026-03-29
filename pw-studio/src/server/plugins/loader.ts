import fs from 'fs'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import { Router } from 'express'
import type { EventEmitter } from 'events'
import type { LoadedPluginSummary, PluginCapability, PluginUiContributions } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'
import type { PluginRuntimeService } from './runtime'

const ALL_EVENTS_CHANNEL = '__all__'
const DEFAULT_PLUGIN_ROOT = path.join(os.homedir(), '.pw-studio', 'plugins')
const PLUGIN_CONFIG_FILE = 'plugins.json'
const PLUGIN_MANIFEST_FILE = 'plugin.json'

type Logger = Pick<Console, 'info' | 'warn' | 'error'>
type PluginEvent = {
  channel: string
  data: unknown
}

export type PwStudioPluginManifest = {
  id: string
  name: string
  version: string
  description?: string
  capabilities: PluginCapability[]
  backendEntry?: string
  frontendEntry?: string
  routeBase?: string
  ui?: PluginUiContributions
}

export interface PluginContext {
  api: ServiceContainer
  events: EventEmitter
  logger: Logger
  runtime: PluginRuntimeService
  manifest: PwStudioPluginManifest
}

export interface PwStudioPlugin {
  setup?(ctx: PluginContext): void | Promise<void>
  activate?(ctx: PluginContext): void | Promise<void>
  deactivate?(): void | Promise<void>
  routes?(router: Router): void
  onEvent?(channel: string, data: unknown): void | Promise<void>
}

type LoadedPlugin = {
  summary: LoadedPluginSummary
  plugin: PwStudioPlugin
  disposeEvent?: () => void
}

export type PluginManager = {
  router: Router
  plugins: LoadedPluginSummary[]
  shutdown: () => Promise<void>
}

function createPluginLogger(logger: Logger, pluginName: string): Logger {
  return {
    info: (...args) => logger.info(`[plugin:${pluginName}]`, ...args),
    warn: (...args) => logger.warn(`[plugin:${pluginName}]`, ...args),
    error: (...args) => logger.error(`[plugin:${pluginName}]`, ...args),
  }
}

function getExtraPluginRoots(): string[] {
  const configuredRoots = new Set<string>()
  configuredRoots.add(path.resolve(process.cwd(), 'plugins'))
  const configPath = path.join(DEFAULT_PLUGIN_ROOT, PLUGIN_CONFIG_FILE)

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
        directories?: string[]
      }

      for (const entry of config.directories ?? []) {
        if (typeof entry === 'string' && entry.trim()) {
          configuredRoots.add(path.resolve(entry))
        }
      }
    } catch {
      // Ignore invalid plugin config files and continue loading defaults.
    }
  }

  const envValue = process.env['PW_STUDIO_PLUGIN_DIRS']
  if (envValue) {
    for (const entry of envValue.split(path.delimiter)) {
      if (entry.trim()) {
        configuredRoots.add(path.resolve(entry.trim()))
      }
    }
  }

  return [...configuredRoots]
}

function listPluginDirectories(rootDir: string): string[] {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return []
  }

  const directPluginFiles = [PLUGIN_MANIFEST_FILE, 'package.json', 'index.js', 'index.mjs', 'index.cjs']
  if (directPluginFiles.some((file) => fs.existsSync(path.join(rootDir, file)))) {
    return [rootDir]
  }

  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name))
}

function normaliseRouteName(pluginId: string): string {
  return pluginId.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-')
}

function readManifest(pluginDir: string): PwStudioPluginManifest {
  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST_FILE)
  if (fs.existsSync(manifestPath)) {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PwStudioPluginManifest
    if (!parsed.id || !parsed.name || !parsed.version) {
      throw new Error(`Invalid plugin manifest in ${manifestPath}`)
    }
    return parsed
  }

  const packageJsonPath = path.join(pluginDir, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      name?: string
      version?: string
      main?: string
      description?: string
      pwStudio?: Partial<PwStudioPluginManifest>
    }
    const pwStudio = parsed.pwStudio ?? {}
    const id = pwStudio.id ?? parsed.name
    if (!id || !parsed.version) {
      throw new Error(`Plugin package at ${pluginDir} is missing id/version metadata`)
    }
    return {
      id,
      name: pwStudio.name ?? parsed.name ?? id,
      version: parsed.version,
      description: pwStudio.description ?? parsed.description,
      capabilities: pwStudio.capabilities ?? ['routes'],
      backendEntry: pwStudio.backendEntry ?? parsed.main,
      frontendEntry: pwStudio.frontendEntry,
      routeBase: pwStudio.routeBase,
      ui: pwStudio.ui,
    }
  }

  throw new Error(`No plugin manifest found in ${pluginDir}`)
}

function resolvePluginEntry(pluginDir: string, manifest: PwStudioPluginManifest): string | null {
  if (manifest.backendEntry) {
    const explicitEntry = path.resolve(pluginDir, manifest.backendEntry)
    if (fs.existsSync(explicitEntry)) {
      return explicitEntry
    }
  }

  for (const fileName of ['index.js', 'index.mjs', 'index.cjs']) {
    const candidate = path.join(pluginDir, fileName)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function isPluginCandidate(value: unknown): value is PwStudioPlugin {
  return Boolean(value && typeof value === 'object')
}

async function importPlugin(pluginDir: string, manifest: PwStudioPluginManifest): Promise<PwStudioPlugin> {
  const entryFile = resolvePluginEntry(pluginDir, manifest)
  if (!entryFile) {
    throw new Error(`No backend entry found for plugin ${manifest.id}`)
  }

  const moduleRef = (await import(pathToFileURL(entryFile).href)) as {
    default?: unknown
    plugin?: unknown
  }

  const candidate = moduleRef.default ?? moduleRef.plugin ?? moduleRef
  if (!isPluginCandidate(candidate)) {
    throw new Error(`Plugin at ${pluginDir} does not export a valid PW Studio plugin module`)
  }

  return candidate
}

export async function loadPlugins(options: {
  services: ServiceContainer
  events: EventEmitter
  runtime: PluginRuntimeService
  logger?: Logger
}): Promise<PluginManager> {
  const logger = options.logger ?? console
  const router = Router()
  const loadedPlugins: LoadedPlugin[] = []
  const pluginSummaries: LoadedPluginSummary[] = []

  fs.mkdirSync(DEFAULT_PLUGIN_ROOT, { recursive: true })

  const pluginRoots = [DEFAULT_PLUGIN_ROOT, ...getExtraPluginRoots()]
  const pluginDirectories = new Set<string>()

  for (const rootDir of pluginRoots) {
    for (const pluginDir of listPluginDirectories(rootDir)) {
      pluginDirectories.add(pluginDir)
    }
  }

  for (const pluginDir of pluginDirectories) {
    let manifest: PwStudioPluginManifest | null = null
    try {
      manifest = readManifest(pluginDir)
      const plugin = await importPlugin(pluginDir, manifest)
      const pluginLogger = createPluginLogger(logger, manifest.name)
      const routeBase = manifest.routeBase ?? normaliseRouteName(manifest.id)
      const pluginContext: PluginContext = {
        api: options.services,
        events: options.events,
        logger: pluginLogger,
        runtime: options.runtime,
        manifest,
      }

      await plugin.setup?.(pluginContext)
      await plugin.activate?.(pluginContext)

      let disposeEvent: (() => void) | undefined

      if (plugin.onEvent) {
        const handler = (event: PluginEvent): void => {
          void Promise.resolve(plugin.onEvent?.(event.channel, event.data)).catch((error) => {
            pluginLogger.error('plugin event handler failed', error)
          })
        }

        options.events.on(ALL_EVENTS_CHANNEL, handler)
        disposeEvent = () => {
          options.events.off(ALL_EVENTS_CHANNEL, handler)
        }
      }

      if (plugin.routes) {
        const pluginRouter = Router()
        plugin.routes(pluginRouter)
        router.use(`/${routeBase}`, pluginRouter)
      }

      const summary: LoadedPluginSummary = {
        ...manifest,
        routeBase,
        status: 'loaded',
        ui: manifest.ui ?? { pages: [], panels: [] },
      }

      pluginLogger.info(`loaded from ${pluginDir}`)
      loadedPlugins.push({ summary, plugin, disposeEvent })
      pluginSummaries.push(summary)
    } catch (error) {
      const summary: LoadedPluginSummary = manifest
        ? {
            ...manifest,
            routeBase: manifest.routeBase ?? normaliseRouteName(manifest.id),
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            ui: manifest.ui ?? { pages: [], panels: [] },
          }
        : {
            id: path.basename(pluginDir),
            name: path.basename(pluginDir),
            version: 'unknown',
            capabilities: [],
            routeBase: normaliseRouteName(path.basename(pluginDir)),
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            ui: { pages: [], panels: [] },
          }

      logger.error(`[plugin-loader] failed to load ${pluginDir}`, error)
      pluginSummaries.push(summary)
    }
  }

  options.runtime.setLoadedPlugins(pluginSummaries)

  return {
    router,
    plugins: pluginSummaries,
    shutdown: async () => {
      for (const loadedPlugin of [...loadedPlugins].reverse()) {
        loadedPlugin.disposeEvent?.()
        if (loadedPlugin.plugin.deactivate) {
          await loadedPlugin.plugin.deactivate()
        }
      }
    },
  }
}
