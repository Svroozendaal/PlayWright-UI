# SKILL: Playwright Binary Detection and Spawn

## Purpose

Rules for detecting, spawning, and interacting with the local Playwright binary from the Electron main process.

## When to Use

- Phase 2: Binary detection, version parsing
- Phase 4: Running tests via spawn
- Phase 6: Codegen/recorder

## Binary Path Resolution

```typescript
// src/main/utils/playwrightBinary.ts
import path from 'path'

export function getPlaywrightBinary(rootPath: string): string {
  const isWindows = process.platform === 'win32'
  return path.join(
    rootPath, 'node_modules', '.bin',
    isWindows ? 'playwright.cmd' : 'playwright'
  )
}
```

**Rules:**
- Always use the LOCAL binary (`node_modules/.bin/playwright`), never global or npx.
- On Windows: binary is `playwright.cmd`, NOT `playwright`.
- Always use `path.join()` — never concatenate paths.

## Spawning Tests

```typescript
import { spawn } from 'child_process'

export function spawnPlaywright(
  args: string[],
  rootPath: string,
  extraEnv?: Record<string, string>
) {
  return spawn(getPlaywrightBinary(rootPath), args, {
    cwd: rootPath,
    shell: false,
    env: { ...process.env, ...extraEnv },
  })
}
```

**Windows `.cmd` handling:**
- `shell: false` works with `.cmd` files on Windows when using `spawn` with the full path.
- If issues arise during PoC, fall back to `shell: true` and document the decision.
- When using `shell: true`, be careful about argument escaping (spaces in paths).

## Version Detection

```typescript
import { execFileSync } from 'child_process'

export function getPlaywrightVersion(rootPath: string): string {
  const out = execFileSync(
    getPlaywrightBinary(rootPath), ['--version'],
    { cwd: rootPath, encoding: 'utf8' }
  )
  const match = out.match(/(\d+\.\d+\.\d+)/)
  return match ? match[1] : 'unknown'
}
```

- Output format: `"Version 1.45.0"` — extract the semver part.
- Minimum version: 1.40.0

## Process Lifecycle

**stdout/stderr handling:**
```typescript
const proc = spawnPlaywright(args, rootPath, envVars)

proc.stdout.on('data', (data: Buffer) => {
  const line = data.toString('utf8')
  // Process each line
})

proc.stderr.on('data', (data: Buffer) => {
  const line = data.toString('utf8')
  // Log stderr separately
})

proc.on('close', (exitCode: number | null) => {
  // exitCode 0 = all passed
  // exitCode 1 = tests ran but some failed
  // exitCode non-0 + no results.json = config error
})
```

**Kill sequence (for cancel):**
```typescript
// On Windows, SIGTERM doesn't work reliably. Use taskkill.
if (process.platform === 'win32') {
  spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'])
} else {
  proc.kill('SIGTERM')
  setTimeout(() => {
    if (!proc.killed) proc.kill('SIGKILL')
  }, 3000)
}
```

**IMPORTANT Windows gotcha:** `process.kill('SIGTERM')` on Windows does NOT send a signal — it terminates the process immediately (equivalent to SIGKILL). For graceful shutdown on Windows, use `taskkill` without `/F` first, then with `/F` after timeout.

## Codegen Command

```typescript
spawnPlaywright(
  ['codegen', '--output=' + outputPath, startUrl],
  rootPath
)
```

## Rules

1. **Always use local binary** — never `npx playwright`.
2. **`shell: false`** by default — fall back to `shell: true` only if .cmd fails.
3. **Use `path.join()`** for binary path construction.
4. **Handle Windows kill differently** — use `taskkill` instead of SIGTERM.
5. **`--reporter=json`** is the fixed parseable output format.
6. **Check binary exists** (`fs.existsSync`) before spawning — give clear error if missing.
