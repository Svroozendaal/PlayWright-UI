# SKILL: Child Process Spawn on Windows

## Purpose

Rules for spawning child processes from Electron's main process, with focus on Windows-specific behaviour.

## When to Use

- Phase 4: Running Playwright tests
- Phase 6: Running codegen
- Phase 2: npm install during project creation

## spawn vs exec vs execFile

| Method | Use when |
|---|---|
| `spawn` | Long-running processes with streaming output (test runs, codegen) |
| `execFileSync` | Quick commands where you need the output (version check) |
| `exec` | Shell commands with piping (npm install) |

## Windows .cmd File Handling

On Windows, Playwright's binary is `playwright.cmd` (a batch file wrapper).

**Recommended approach:**
```typescript
spawn(getPlaywrightBinary(rootPath), args, {
  cwd: rootPath,
  shell: false,
  env: { ...process.env, ...extraEnv },
})
```

**If `shell: false` fails with `.cmd` files:**
Fall back to `shell: true`. Document the decision in ARCHITECTURE.md.
```typescript
spawn(getPlaywrightBinary(rootPath), args, {
  cwd: rootPath,
  shell: true,  // fallback — enables .cmd execution
  env: { ...process.env, ...extraEnv },
})
```

**Gotcha with `shell: true`:** Arguments containing spaces need quoting. Prefer `shell: false` when possible.

## stdout/stderr Encoding on Windows

```typescript
const proc = spawn(binary, args, {
  cwd: rootPath,
  shell: false,
  env: { ...process.env, ...extraEnv },
})

// Always decode as utf8
proc.stdout.setEncoding('utf8')
proc.stderr.setEncoding('utf8')

proc.stdout.on('data', (chunk: string) => {
  // chunk may contain multiple lines
  const lines = chunk.split('\n')
  for (const line of lines) {
    if (line.trim()) processLine(line)
  }
})
```

**Windows encoding gotcha:** Some Windows tools output in the system codepage (e.g. cp1252) rather than UTF-8. Playwright itself outputs UTF-8, but `npm` commands may not. For npm: set `env.CHCP = '65001'` or `env.PYTHONUTF8 = '1'` if needed.

## Exit Code Interpretation

| Exit code | Meaning |
|---|---|
| 0 | All tests passed |
| 1 | Tests ran but some failed |
| Non-0 + no results.json | Config error (Playwright didn't start) |
| null | Process was killed (cancelled) |

## Process Kill Sequence on Windows

Windows does not support Unix signals. `process.kill('SIGTERM')` on Windows terminates immediately (same as SIGKILL).

**Recommended pattern:**
```typescript
function killProcess(proc: ChildProcess): void {
  if (process.platform === 'win32') {
    // /T = kill child processes, /F = force
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'])
  } else {
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL')
    }, 3000)
  }
}
```

**Why `/T` flag:** Playwright spawns browser sub-processes. Without `/T`, killing the parent leaves orphaned browser processes.

## Environment Variable Passing

```typescript
const envVars: Record<string, string> = {
  ...process.env,
  ...extraEnv,
  // Playwright-specific:
  BASE_URL: resolvedEnv?.baseURL ?? '',
  // Force JSON reporter:
  PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(runDir, 'results.json'),
}
```

## Rules

1. **Use `spawn` for test runs** — need streaming output.
2. **Use `execFileSync` for quick checks** — version detection, dry-runs.
3. **`shell: false` by default** — fall back to `shell: true` only if needed.
4. **Use `taskkill /T /F` on Windows** — kills child processes too.
5. **Set encoding to utf8** — `proc.stdout.setEncoding('utf8')`.
6. **Always pass `cwd`** — never rely on the process's current directory.
7. **Test during PoC** — Windows spawn behaviour is the most uncertain part.
