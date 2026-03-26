# SKILL: Path Safety

## Purpose

Rules for safe path handling across the entire PW Studio codebase, with focus on Windows compatibility.

## When to Use

- Phase 7: Path audit
- Every phase: applied during code review

## Path Construction

**Always use `path.join()` or `path.resolve()`:**
```typescript
// GOOD
const dbPath = path.join(app.getPath('userData'), 'pw-studio.db')
const binary = path.join(rootPath, 'node_modules', '.bin', 'playwright.cmd')

// BAD — never concatenate with +
const dbPath = app.getPath('userData') + '/pw-studio.db'
const binary = rootPath + '\\node_modules\\.bin\\playwright.cmd'
```

**`path.join()` vs `path.resolve()`:**
- `path.join()` — combines path segments. Use for building relative or known paths.
- `path.resolve()` — resolves to absolute path from right to left. Use when you need a guaranteed absolute path.

## app.getPath() Reference

| Key | Windows location | Use |
|---|---|---|
| `userData` | `%APPDATA%/<appName>` | Database, app config |
| `documents` | `C:\Users\<user>\Documents` | Default workspace suggestion |
| `temp` | `%TEMP%` | Temporary files (cleaned by OS) |
| `home` | `C:\Users\<user>` | User's home directory |

**Timing:** `app.getPath()` only works after `app.whenReady()`. Never call at module load time.

## Windows-Specific Pitfalls

### Backslashes
- Windows uses `\`, Unix uses `/`. `path.join()` handles this automatically.
- Never hardcode backslashes: `'C:\\Users\\...'`
- Never hardcode forward slashes for filesystem paths: `'/home/...'`

### Spaces in paths
- `"C:\Program Files\..."` — always quote paths in shell commands.
- When using `spawn` with `shell: false`, arguments are passed as array — no quoting needed.
- When using `shell: true`, wrap paths in double quotes.

### Long paths
- Windows has a 260-character path limit by default.
- Node.js handles long paths via UNC prefix (`\\?\`) internally.
- Avoid deeply nested run artifact directories to stay under the limit.

### Drive letters
- Don't assume `C:\` — the project may be on any drive.
- `path.resolve()` handles different drives correctly.
- Never strip drive letters from paths.

### Unicode
- Windows supports Unicode filenames. `path.join()` handles them correctly.
- Ensure SQLite stores paths as UTF-8 (default).

## Audit Checklist (Phase 7)

Search the entire codebase for:
1. `\\` in strings (backslash literals) — replace with `path.join()`
2. `'C:\\'` or `'/home/'` — hardcoded paths
3. String concatenation with `+` for paths — replace with `path.join()`
4. `'tests/'` hardcoded — replace with `configSummary.testDir`
5. `app.getPath()` called before `app.whenReady()`

## Rules

1. **Always `path.join()`** — never concatenate paths with `+` or template literals.
2. **Always `app.getPath()`** — never hardcode system directories.
3. **Test with spaces and non-C: drives** — `D:\My Projects\test suite\` must work.
4. **`configSummary.testDir`** — never hardcode `tests/`.
5. **Quote paths in shell commands** when using `shell: true`.
