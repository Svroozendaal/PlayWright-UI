# SKILL: Playwright Config Reader

## Purpose

Rules for dynamically reading `playwright.config.ts` to extract `testDir`, `projects`, and `outputDir` without hardcoding assumptions.

## When to Use

- Phase 2: Health checks (configReadable, testDir existence)
- Phase 3: Explorer root, watcher targets
- Phase 4: Browser dropdown (projects list)
- Any service that needs testDir or outputDir

## The Cardinal Rule

**NEVER hardcode `tests/` as testDir.** Always use `configSummary.testDir` from `PlaywrightConfigService`.

## Config Extraction

Playwright configs are TypeScript and cannot be read with a simple JSON parser. Use a spawned Node process:

```typescript
// src/main/utils/playwrightConfigReader.ts
import path from 'path'
import { execFileSync } from 'child_process'

export type PlaywrightConfigSummary = {
  testDir: string           // absolute path
  projects: string[]        // list of project names (browser configs)
  outputDir: string         // absolute path, default: test-results/
}

export function readPlaywrightConfig(rootPath: string): PlaywrightConfigSummary {
  const extractorScript = buildExtractorScript()
  const output = execFileSync(
    process.execPath,   // system Node (not Electron's bundled Node)
    ['--input-type=module'],
    {
      input: extractorScript,
      cwd: rootPath,
      encoding: 'utf8',
      env: { ...process.env, PWSTUDIO_EXTRACT: '1' },
    }
  )
  return JSON.parse(output)
}
```

The extractor script dynamically imports the config and extracts the needed fields. See blueprint section 8 for the full script.

## Fallback Behaviour

If the config cannot be read (parse error, missing file):
- `testDir` → `path.join(rootPath, 'tests')` as fallback
- Show warning in Health Panel: "Could not read playwright.config.ts — testDir falls back to 'tests/'"
- The app remains functional

## Caching Strategy

```typescript
// PlaywrightConfigService
private configCache = new Map<string, { summary: PlaywrightConfigSummary; cachedAt: number }>()

getConfigSummary(projectId: string, rootPath: string): PlaywrightConfigSummary {
  const cached = this.configCache.get(projectId)
  if (cached && Date.now() - cached.cachedAt < 60_000) return cached.summary
  const summary = readPlaywrightConfig(rootPath)
  this.configCache.set(projectId, { summary, cachedAt: Date.now() })
  return summary
}

invalidateConfigCache(projectId: string): void {
  this.configCache.delete(projectId)
}
```

- Cache TTL: 60 seconds
- Invalidated when `playwright.config.*` changes (FileWatchService event)
- Invalidated on manual health refresh

## Where configSummary.testDir Is Used

| Component | Usage |
|---|---|
| ProjectHealthService | Health check `testsFolder` |
| FileWatchService | Watch target |
| ProjectIndexService | Explorer root |
| RecorderService | Directory picker constraint |
| CommandBuilder | `--output` for artifacts |

## Rules

1. **NEVER hardcode `tests/`** — always `configSummary.testDir`.
2. **Cache the result** — `readPlaywrightConfig()` spawns a process.
3. **Invalidate on config file change** — watcher triggers cache clear.
4. **Fallback gracefully** — unreadable config should not crash the app.
5. **`projects` list feeds the browser dropdown** — empty list = show text input instead.
