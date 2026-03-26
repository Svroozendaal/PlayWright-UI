# PHASE 4 — Run Engine

## First Step

1. Read `.agents/AGENTS.md`.
2. Read `.agents/FRAMEWORK.md`.
3. Read `.app-info/ROUTING.md`.
4. Read `.app-info/docs/PW_STUDIO_BLUEPRINT.md` — the full architecture reference.

## Agent Routing

Per AGENTS.md routing rules:
- **Developer** — RunService, CommandBuilder, RunResultParser, cancel flow, migrations.
- **Designer** — Runs screen, Run Detail screen, run dialog modal.
- **Tester** — PoC validation (Windows spawn, encoding, exit codes, JSON reporter).

Sequence: Developer (PoC first) → Developer (full implementation) → Designer → Tester.

## Prerequisites

Phase 1+2 complete. Phase 3 in progress. Start this as PoC PARALLEL to Phase 3 as soon as the explorer shows one file.

## Required Skills

Before starting, load and follow:

- `.app-info/skills/playwright-binary/SKILL.md` — binary detection, spawn, version parsing.
- `.app-info/skills/playwright-config-reader/SKILL.md` — reading projects list for browser dropdown.
- `.app-info/skills/electron-ipc/SKILL.md` — IPC envelope, push events, log streaming protocol.
- `.app-info/skills/sqlite-migrations/SKILL.md` — migration 2 for runs tables.
- `.app-info/skills/child-process-spawn/SKILL.md` — spawn on Windows, .cmd binaries, encoding, exit codes.
- `.app-info/skills/playwright-json-reporter/SKILL.md` — JSON report parsing, result mapping.
- `.agents/skills/code-quality/SKILL.md` — shared code quality checklist.
- `.agents/skills/security-review/SKILL.md` — security checklist for process spawning.

## Goal

Drive Playwright tests via the local binary, stream logs, store results.
**VALIDATE EARLY:** this is the most technically uncertain phase.

**PoC validation goals (do this first):**
- `child_process.spawn()` on Windows with local `.cmd` binary → works?
- stdout/stderr received correctly, no encoding issues?
- Exit code: 0 when all passed, 1 when failures?
- JSON reporter `results.json` created and parseable?
- `.artifacts/runs/` directory correctly created?

## Deliverables

### 1. CLI Command Builder
Builds the argument array for spawn (not a string, an array of args):

Input: `RunRequest` (see blueprint section 12 — RunService)

Always present: `['test', '--reporter=json', '--reporter=html']`

**Browser** (use `BrowserSelection` type from blueprint section 12 — RunService):
- `{ mode: 'single', projectName: 'chromium' }` → `['--project=chromium']`
- `{ mode: 'all' }` → no `--project` flag (Playwright runs everything)

The list of available project names comes from `PlaywrightConfigService.get().projects`.

**Target:** file path or folder as extra arg
**Test filter:** `['--grep=<testTitleFilter>']`
**Headed:** `['--headed']`
**Debug:** `['--debug']`
**Output dir:** `['--output=<runDir>']`
**Artifact flags:** `buildArtifactFlags(resolvedPolicy)` (see blueprint section 10)
**BaseURL override:** via `BASE_URL` env var (not as CLI arg)

Public method `buildCommand(request): string[]` so the UI can display it.

### 2. Run Directory Creation
`<rootPath>/.artifacts/runs/<run-id>/`
Create subdirs: `log.txt` (empty), `traces/`, `screenshots/`, `videos/`
Playwright's `--output` flag points here for attachments.

### 3. RunService — Start Run
```
startRun(request: RunRequest): Promise<string>  // returns runId
```

Steps:
1. Check: is there already an active run? → throw `ActiveRunError`
2. Create run row in SQLite (status: `'queued'`)
3. Create run directory
4. Resolve environment (stub in Phase 4, full in Phase 6)
5. Build command
6. Call `spawnPlaywright(args, rootPath, envVars)`
7. Update status to `'running'`
8. Stream stdout/stderr (see point 4)

### 4. Log Streaming
Protocol: see blueprint section 4 — Log streaming protocol.

Per stdout/stderr line:
- Write to `log.txt` (`fs.appendFileSync` or write stream)
- If `request.streamLogs`: `webContents.send(IPC.RUNS_LOG_EVENT, logEvent)`

```typescript
type LogEvent = { runId: string; line: string; timestamp: string; source: 'stdout' | 'stderr' }
```

On process `'close'` event:
1. Store exit code
2. Determine outcome via `determineOutcome()`:
   - `exitCode === 0` → `'passed'`
   - `exitCode !== 0` + `results.json` parseable → `'failed'` (tests ran but failed)
   - `exitCode !== 0` + `results.json` missing → `'config-error'` (Playwright didn't start)
3. Parse `results.json` → store `run_test_results` (only for `'failed'`, not for `'config-error'`)
4. Determine and store `reportPath`
5. Update `run.status` to outcome
6. Store `run.finishedAt`
7. `webContents.send(IPC.RUNS_STATUS_CHANGED, { runId, status: outcome, finishedAt })`

### 5. RunResultParser
Implement `parseJsonReport()` from blueprint section 9.
Store `safeTitleForGrep` (regex-escaped test title) — needed for Phase 5 rerunFailed.
`results.json` location: `<runDir>/results.json`

**IMPORTANT:** Playwright's JSON reporter writes to stdout if no output path is specified. In the command builder use:
`--reporter=json` (output to stdout) AND `--reporter=html` (output to report/).
Capture stdout and write to `results.json` yourself, OR use `--reporter=json:<runDir>/results.json` syntax if the version supports it.
**Test both approaches during the PoC.**

### 6. Cancel Flow
```
cancelRun(runId): Promise<void>
```
Order (see blueprint section 4 — Cancel flow):
1. `process.kill('SIGTERM')`
2. `setTimeout` 3000ms
3. If not yet closed: `process.kill('SIGKILL')`
4. `status = 'cancelled'` store in SQLite
5. `webContents.send(IPC.RUNS_STATUS_CHANGED, { runId, status: 'cancelled' })`

### 7. Database: Migrations for Runs
Migration 2: `runs` table + `run_test_results` table (see blueprint section 13).
`runs.status` contains: `'queued' | 'running' | 'passed' | 'failed' | 'config-error' | 'cancelled'`
`parentRunId` and `safeTitleForGrep` come in migration 3 (Phase 5).

### 8. IPC Handlers
`runs:start`, `runs:getActive`, `runs:list`, `runs:getById`, `runs:cancel`, `runs:rerun` (full rerun with same config).

`RUNS_LOG_EVENT` and `RUNS_STATUS_CHANGED` are push channels (no handler needed, main pushes via `webContents.send`).

### 9. UI: Runs Screen
List of runs (most recent first).
Columns: timestamp, target, browser, status badge, duration.
Filters: status (passed/failed/cancelled), date.
Click → Run Detail.

### 10. UI: Run Detail Screen
Tabs: Summary | Logs | Tests | Metadata

- **Summary:** status, command (show `buildCommand` output), duration, test counts
- **Logs:** `log.txt` contents, scrollable, live updates during active run. Renderer: `on(RUNS_LOG_EVENT)` at mount, `off()` at unmount. Scroll-to-bottom on new lines (unless user has scrolled up).
- **Tests:** `run_test_results` per test, status icon, error message if present
- **Metadata:** runId, browser, environment, overrides

Actions: Cancel (during active run) | Rerun | Open HTML report (`shell.openExternal`)

**config-error state (separate from failed):**
- Summary tab: prominent "Playwright could not start" message
- Logs tab: automatically opened (most useful info for config-error)
- Tests tab: shows "No test results — see logs"
- Rerun button present (user can fix config and rerun)

### 11. UI: Run Entrypoints in Explorer
Context menu actions (Run / Debug) now functional.

**Run dialog (modal):**
- Browser dropdown: options from `PlaywrightConfigService.get(projectId).projects`. If projects is empty (config fallback): show manual text field instead of dropdown. Option "All browsers" always present at top → `BrowserSelection { mode: 'all' }`.
- Environment dropdown: options = `listEnvironments(projectId)` + "No environment". Default pre-selected: `projects.activeEnvironment`.
- Headed toggle
- "Advanced" toggle → shows baseURL override + extra env vars fields
- Confirm → call `runs:start`
- While run is active: run buttons disabled, "Cancel" button visible

## Exit Criteria

- Running a test file, folder, or all via UI works.
- Logs visible in Run Detail (live during active run).
- Test results per test visible (passed/failed/skipped).
- Cancel and rerun work.
- During active run, other start buttons are disabled.
