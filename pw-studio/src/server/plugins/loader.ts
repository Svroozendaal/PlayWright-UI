import fs from 'fs'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import { Router } from 'express'
import type { EventEmitter } from 'events'
import type { ServiceContainer } from '../services/ServiceContainer'

const ALL_EVENTS_CHANNEL = '__all__'
const DEFAULT_PLUGIN_ROOT = path.join(os.homedir(), '.pw-studio', 'plugins')
const PLUGIN_CONFIG_FILE = 'plugins.json'

type Logger = Pick<Console, 'info' | 'warn' | 'error'>
type PluginEvent = {
  channel: string
  data: unknown
}

export interface PluginContext {
  api: ServiceContainer
  events: EventEmitter
  logger: Logger
}

export interface PwStudioPlugin {
  name: string
  version: string
  activate(ctx: PluginContext): void | Promise<void>
  deactivate?(): void | Promise<void>
  routes?(router: Router): void
  onEvent?(channel: string, data: unknown): void | Promise<void>
}

type LoadedPlugin = {
  routeName: string
  plugin: PwStudioPlugin
  disposeEvent?: () => void
}

export type PluginManager = {
  router: Router
  plugins: LoadedPlugin[]
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
  const configPath = path.join(DEFAULT_PLUGIN_ROOT, PLUGIN_CONFIG_FILE)
  const configuredRoots = new Set<string>()

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

  const directPluginFiles = ['index.js', 'index.mjs', 'index.cjs', 'package.json']
  if (directPluginFiles.some((file) => fs.existsSync(path.join(rootDir, file)))) {
    return [rootDir]
  }

  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name))
}

function resolvePluginEntry(pluginDir: string): string | null {
  const packageJsonPath = path.join(pluginDir, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
        main?: string
      }
      const mainFile = packageJson.main ? path.resolve(pluginDir, packageJson.main) : null
      if (mainFile && fs.existsSync(mainFile)) {
        return mainFile
      }
    } catch {
      // Fall through to default entry points.
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

function normaliseRouteName(pluginName: string): string {
  return pluginName.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-')
}

function isPluginCandidate(value: unknown): value is PwStudioPlugin {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as PwStudioPlugin).name === 'string' &&
      typeof (value as PwStudioPlugin).version === 'string' &&
      typeof (value as PwStudioPlugin).activate === 'function'
  )
}

async function importPlugin(pluginDir: string): Promise<PwStudioPlugin> {
  const entryFile = resolvePluginEntry(pluginDir)
  if (!entryFile) {
    throw new Error(`No plugin entry file found in ${pluginDir}`)
  }

  const moduleRef = (await import(pathToFileURL(entryFile).href)) as {
    default?: unknown
    plugin?: unknown
  }

  const candidate = moduleRef.default ?? moduleRef.plugin ?? moduleRef
  if (!isPluginCandidate(candidate)) {
    throw new Error(`Plugin at ${pluginDir} does not export a valid PwStudioPlugin`)
  }

  return candidate
}

export async function loadPlugins(options: {
  services: ServiceContainer
  events: EventEmitter
  logger?: Logger
}): Promise<PluginManager> {
  const logger = options.logger ?? console
  const router = Router()
  const loadedPlugins: LoadedPlugin[] = []

  fs.mkdirSync(DEFAULT_PLUGIN_ROOT, { recursive: true })

  const pluginRoots = [DEFAULT_PLUGIN_ROOT, ...getExtraPluginRoots()]
  const pluginDirectories = new Set<string>()

  for (const rootDir of pluginRoots) {
    for (const pluginDir of listPluginDirectories(rootDir)) {
      pluginDirectories.add(pluginDir)
    }
  }

  for (const pluginDir of pluginDirectories) {
    try {
      const plugin = await importPlugin(pluginDir)
      const pluginLogger = createPluginLogger(logger, plugin.name)
      const routeName = normaliseRouteName(plugin.name)
      const pluginContext: PluginContext = {
        api: options.services,
        events: options.events,
        logger: pluginLogger,
      }

      await plugin.activate(pluginContext)

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
        router.use(`/${routeName}`, pluginRouter)
      }

      pluginLogger.info(`loaded from ${pluginDir}`)
      loadedPlugins.push({ routeName, plugin, disposeEvent })
    } catch (error) {
      logger.error(`[plugin-loader] failed to load ${pluginDir}`, error)
    }
  }

  return {
    router,
    plugins: loadedPlugins,
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
