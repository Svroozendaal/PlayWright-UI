import fs from 'fs'
import path from 'path'
import { watch, type FSWatcher } from 'chokidar'
import { WS_EVENTS } from '../../shared/types/ipc'
import type { PlaywrightConfigService } from './PlaywrightConfigService'
import type { ProjectHealthService } from './ProjectHealthService'
import type { EnvironmentService } from './EnvironmentService'

export type FileWatchEvent = {
  projectId: string
  kind: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
}

type WatcherEntry = {
  watcher: FSWatcher
  rootPath: string
}

const IGNORED = [
  '**/node_modules/**',
  '**/test-results/**',
  '**/playwright-report/**',
  '**/.git/**',
  '**/.artifacts/**',
]

const DEBOUNCE_MS = 300

export class FileWatchService {
  private watchers = new Map<string, WatcherEntry>()

  private configService: PlaywrightConfigService

  private healthService: ProjectHealthService

  private environmentService: EnvironmentService

  private onFileEvent: ((event: FileWatchEvent) => void) | null = null

  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  private publish: (channel: string, data: unknown) => void

  constructor(
    publish: (channel: string, data: unknown) => void,
    configService: PlaywrightConfigService,
    healthService: ProjectHealthService,
    environmentService: EnvironmentService
  ) {
    this.publish = publish
    this.configService = configService
    this.healthService = healthService
    this.environmentService = environmentService
  }

  setOnFileEvent(handler: (event: FileWatchEvent) => void): void {
    this.onFileEvent = handler
  }

  watchProject(projectId: string, rootPath: string): void {
    this.unwatchProject(projectId)

    const configSummary = this.configService.get(projectId, rootPath)
    const targets = getWatchTargets(rootPath, configSummary.testDir)

    if (targets.length === 0) {
      return
    }

    const watcher = watch(targets, {
      ignored: IGNORED,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    })

    const emitDebounced = (kind: FileWatchEvent['kind'], filePath: string): void => {
      const key = `${projectId}:${filePath}`
      const existing = this.debounceTimers.get(key)
      if (existing) {
        clearTimeout(existing)
      }

      this.debounceTimers.set(
        key,
        setTimeout(() => {
          this.debounceTimers.delete(key)
          const event: FileWatchEvent = { projectId, kind, path: filePath }
          this.handleSpecialTriggers(projectId, rootPath, filePath)
          this.onFileEvent?.(event)
        }, DEBOUNCE_MS)
      )
    }

    watcher.on('add', (filePath: string) => emitDebounced('add', filePath))
    watcher.on('change', (filePath: string) => emitDebounced('change', filePath))
    watcher.on('unlink', (filePath: string) => emitDebounced('unlink', filePath))
    watcher.on('addDir', (filePath: string) => emitDebounced('addDir', filePath))
    watcher.on('unlinkDir', (filePath: string) => emitDebounced('unlinkDir', filePath))

    this.watchers.set(projectId, { watcher, rootPath })
  }

  unwatchProject(projectId: string): void {
    const entry = this.watchers.get(projectId)
    if (entry) {
      void entry.watcher.close()
      this.watchers.delete(projectId)
    }

    for (const [key, timer] of this.debounceTimers) {
      if (key.startsWith(`${projectId}:`)) {
        clearTimeout(timer)
        this.debounceTimers.delete(key)
      }
    }
  }

  unwatchAll(): void {
    for (const [projectId] of this.watchers) {
      this.unwatchProject(projectId)
    }
  }

  private handleSpecialTriggers(projectId: string, rootPath: string, filePath: string): void {
    const relative = path.relative(rootPath, filePath).replace(/\\/g, '/')

    if (/^playwright\.config\.(ts|js|mjs)$/.test(relative)) {
      this.configService.invalidateCache(projectId)
      this.healthService.invalidateCache(projectId)
      this.watchProject(projectId, rootPath)
      this.publish(WS_EVENTS.HEALTH_REFRESH, { projectId })
    }

    if (relative.startsWith('environments/')) {
      this.environmentService.invalidateCache(projectId)
      this.publish(WS_EVENTS.ENVIRONMENTS_CHANGED, { projectId })
    }
  }
}

function getWatchTargets(rootPath: string, testDir: string): string[] {
  const targets: string[] = []

  if (fs.existsSync(testDir)) {
    targets.push(testDir)
  }

  const optionalDirs = ['environments', 'pages', 'fixtures']
  for (const dir of optionalDirs) {
    const fullPath = path.join(rootPath, dir)
    if (fs.existsSync(fullPath)) {
      targets.push(fullPath)
    }
  }

  const configFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']
  for (const fileName of configFiles) {
    const fullPath = path.join(rootPath, fileName)
    if (fs.existsSync(fullPath)) {
      targets.push(fullPath)
    }
  }

  return targets
}
