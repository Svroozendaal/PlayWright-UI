import fs from 'fs'
import path from 'path'
import { watch, type FSWatcher } from 'chokidar'
import type { BrowserWindow } from 'electron'
import { IPC } from '../../shared/types/ipc'
import type { PlaywrightConfigService } from './PlaywrightConfigService'
import type { ProjectHealthService } from './ProjectHealthService'

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
  private win: BrowserWindow
  private configService: PlaywrightConfigService
  private healthService: ProjectHealthService
  private onFileEvent: ((event: FileWatchEvent) => void) | null = null
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    win: BrowserWindow,
    configService: PlaywrightConfigService,
    healthService: ProjectHealthService
  ) {
    this.win = win
    this.configService = configService
    this.healthService = healthService
  }

  setOnFileEvent(handler: (event: FileWatchEvent) => void): void {
    this.onFileEvent = handler
  }

  watchProject(projectId: string, rootPath: string): void {
    // Clean up existing watcher for this project
    this.unwatchProject(projectId)

    const configSummary = this.configService.get(projectId, rootPath)
    const targets = getWatchTargets(rootPath, configSummary.testDir)

    if (targets.length === 0) return

    const watcher = watch(targets, {
      ignored: IGNORED,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    })

    const emitDebounced = (kind: FileWatchEvent['kind'], filePath: string): void => {
      const key = `${projectId}:${filePath}`
      const existing = this.debounceTimers.get(key)
      if (existing) clearTimeout(existing)

      this.debounceTimers.set(
        key,
        setTimeout(() => {
          this.debounceTimers.delete(key)
          const event: FileWatchEvent = { projectId, kind, path: filePath }

          // Special triggers
          this.handleSpecialTriggers(projectId, rootPath, filePath)

          // Notify listeners
          this.onFileEvent?.(event)
        }, DEBOUNCE_MS)
      )
    }

    watcher.on('add', (p: string) => emitDebounced('add', p))
    watcher.on('change', (p: string) => emitDebounced('change', p))
    watcher.on('unlink', (p: string) => emitDebounced('unlink', p))
    watcher.on('addDir', (p: string) => emitDebounced('addDir', p))
    watcher.on('unlinkDir', (p: string) => emitDebounced('unlinkDir', p))

    this.watchers.set(projectId, { watcher, rootPath })
  }

  unwatchProject(projectId: string): void {
    const entry = this.watchers.get(projectId)
    if (entry) {
      void entry.watcher.close()
      this.watchers.delete(projectId)
    }

    // Clean up debounce timers for this project
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

    // Config file changed -> invalidate config + health, restart watcher
    if (/^playwright\.config\.(ts|js|mjs)$/.test(relative)) {
      this.configService.invalidateCache(projectId)
      this.healthService.invalidateCache(projectId)

      // Restart watcher with new config
      this.watchProject(projectId, rootPath)

      // Push health refresh to renderer
      this.win.webContents.send(IPC.HEALTH_REFRESH, { projectId })
    }

    // Environment file changed -> notify renderer
    if (relative.startsWith('environments/')) {
      this.win.webContents.send(IPC.ENVIRONMENTS_CHANGED, { projectId })
    }
  }
}

function getWatchTargets(rootPath: string, testDir: string): string[] {
  const targets: string[] = []

  // Always watch testDir
  if (fs.existsSync(testDir)) {
    targets.push(testDir)
  }

  // Optional directories
  const optionalDirs = ['environments', 'pages', 'fixtures']
  for (const dir of optionalDirs) {
    const fullPath = path.join(rootPath, dir)
    if (fs.existsSync(fullPath)) {
      targets.push(fullPath)
    }
  }

  // Config files
  const configFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']
  for (const f of configFiles) {
    const fullPath = path.join(rootPath, f)
    if (fs.existsSync(fullPath)) {
      targets.push(fullPath)
    }
  }

  return targets
}
