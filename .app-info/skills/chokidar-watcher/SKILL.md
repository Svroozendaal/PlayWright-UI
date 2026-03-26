# SKILL: chokidar File Watching

## Purpose

Rules for file system watching using chokidar in PW Studio's main process.

## When to Use

- Phase 3: FileWatchService setup
- Phase 6: Environment file change detection

## Package

Use `chokidar` v3.x (stable, well-tested). v4 exists but has API changes — evaluate before adopting.

```bash
npm install chokidar
```

## Watch Target Resolution

**Only watch paths that exist.** chokidar throws warnings for non-existent paths.

```typescript
function getWatchTargets(rootPath: string, configSummary: PlaywrightConfigSummary): string[] {
  const candidates = [
    configSummary.testDir,
    path.join(rootPath, 'environments'),
    path.join(rootPath, 'pages'),
    path.join(rootPath, 'fixtures'),
    path.join(rootPath, 'playwright.config.ts'),
    path.join(rootPath, 'playwright.config.js'),
  ]
  return candidates.filter(p => fs.existsSync(p))
}
```

## Ignored Paths

```typescript
const IGNORED_PATTERNS = [
  '**/node_modules/**',
  '**/test-results/**',
  '**/playwright-report/**',
  '**/.git/**',
  '**/.artifacts/**',
]
```

## Watcher Setup

```typescript
import chokidar from 'chokidar'

const watcher = chokidar.watch(watchTargets, {
  ignored: IGNORED_PATTERNS,
  persistent: true,
  ignoreInitial: true,     // Don't fire events for existing files
  awaitWriteFinish: {
    stabilityThreshold: 300,  // Debounce: wait 300ms after last change
    pollInterval: 100,
  },
})

watcher
  .on('add', path => handleEvent('add', path))
  .on('change', path => handleEvent('change', path))
  .on('unlink', path => handleEvent('unlink', path))
  .on('addDir', path => handleEvent('addDir', path))
  .on('unlinkDir', path => handleEvent('unlinkDir', path))
```

## Event Debouncing

Use 300ms debounce to batch rapid file system events:

```typescript
private debounceTimers = new Map<string, NodeJS.Timeout>()

private handleEvent(kind: string, filePath: string, projectId: string): void {
  const key = `${projectId}:${kind}:${filePath}`
  const existing = this.debounceTimers.get(key)
  if (existing) clearTimeout(existing)

  this.debounceTimers.set(key, setTimeout(() => {
    this.debounceTimers.delete(key)
    this.emitEvent({ projectId, kind, path: filePath })
  }, 300))
}
```

## Special Triggers

### Environment file changes
```typescript
if (filePath.includes(path.join(rootPath, 'environments'))) {
  services.environmentService.invalidateCache(projectId)
  win.webContents.send(IPC.ENVIRONMENTS_CHANGED, { projectId })
  // If deleted file was activeEnvironment → reset to null
}
```

### Config file changes
```typescript
if (filePath.match(/playwright\.config\.(ts|js|mjs)$/)) {
  services.playwrightConfigService.invalidateConfigCache(projectId)
  services.projectHealthService.invalidateCache(projectId)
  // Recalculate watch targets and restart watcher
}
```

## Watcher Lifecycle

```typescript
watchProject(projectId: string, rootPath: string): void
// 1. Get configSummary via PlaywrightConfigService
// 2. Calculate watch targets
// 3. Create chokidar watcher
// 4. Store watcher reference for cleanup

unwatchProject(projectId: string): void
// 1. Close the chokidar watcher
// 2. Clear debounce timers
// 3. Remove stored references
```

## Rules

1. **Only watch existing paths** — `fs.existsSync()` before adding to watch targets.
2. **Debounce events at 300ms** — prevent redundant rebuilds.
3. **Watcher does NO parsing** — only reports events; indexer does the work.
4. **Clean up on unwatchProject** — close watchers, clear timers.
5. **Restart watcher when config changes** — recalculate targets from new configSummary.
6. **Use `ignoreInitial: true`** — don't fire events for pre-existing files.
