# SKILL: Artifact Policy Resolution

## Purpose

Rules for resolving artifact policies (screenshot, trace, video) from file-level overrides down to project defaults, and mapping them to Playwright CLI flags.

## When to Use

- Phase 5: Artifact policy implementation
- Phase 4: Command builder integration

## Resolution Order

1. Look in `file_artifact_policies WHERE projectId = ? AND filePath = ?` (exact file match)
2. Fallback: `WHERE projectId = ? AND filePath = '*'` (project default)
3. If no project default exists, use hardcoded fallback:
   ```typescript
   { screenshotMode: 'on-failure', traceMode: 'on-failure', videoMode: 'off' }
   ```

## CLI Flag Mapping

App internal modes differ from Playwright CLI flags. Exact mapping:

| App mode | `--screenshot=` | `--video=` | `--trace=` |
|---|---|---|---|
| `'off'` | `off` | `off` | `off` |
| `'on-failure'` | `only-on-failure` | `retain-on-failure` | `retain-on-failure` |
| `'always'` | `on` | `on` | `on` |

```typescript
function buildArtifactFlags(policy: ResolvedArtifactPolicy): string[] {
  const ssMap  = { 'off': 'off', 'on-failure': 'only-on-failure',   'always': 'on' }
  const vidMap = { 'off': 'off', 'on-failure': 'retain-on-failure', 'always': 'on' }
  const trMap  = { 'off': 'off', 'on-failure': 'retain-on-failure', 'always': 'on' }
  return [
    `--screenshot=${ssMap[policy.screenshotMode]}`,
    `--video=${vidMap[policy.videoMode]}`,
    `--trace=${trMap[policy.traceMode]}`,
  ]
}
```

## Database Schema

```sql
CREATE TABLE file_artifact_policies (
  id             TEXT PRIMARY KEY,
  projectId      TEXT NOT NULL,
  filePath       TEXT NOT NULL,       -- '*' = project default
  screenshotMode TEXT NOT NULL,       -- 'off' | 'on-failure' | 'always'
  traceMode      TEXT NOT NULL,
  videoMode      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);
```

## UI Conventions

- Show "Project default" label when no file-specific override exists.
- "Reset to project default" button removes the file-level row.
- Direct save on change (no separate Save button).
- Badge on file node in explorer tree when custom policy is active.

## Rules

1. **Resolution cascades:** file → project default → hardcoded fallback.
2. **`filePath = '*'`** represents the project default.
3. **Map modes correctly** — `'on-failure'` maps to different Playwright flags per artifact type.
4. **Never expose Playwright flag names in the UI** — use app-internal mode names.
