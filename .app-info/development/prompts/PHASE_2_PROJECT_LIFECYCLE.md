# PHASE 2 — Project Lifecycle + Health

## First Step

1. Read `.agents/AGENTS.md`.
2. Read `.agents/FRAMEWORK.md`.
3. Read `.app-info/ROUTING.md`.
4. Read `.app-info/docs/PW_STUDIO_BLUEPRINT.md` — the full architecture reference.

## Agent Routing

Per AGENTS.md routing rules:
- **Developer** — binary helper, health service, config reader, template service.
- **Designer** — wizard UI, health panel.
- **Tester** — validate health checks, wizard flow, conflict handling.

Sequence: Developer → Designer → Tester.

## Prerequisites

Phase 1 is complete: Electron runs, registry works, SQLite + migrations set up, preload/contextBridge fully present, IPC constants in `shared/types/ipc.ts`.

## Required Skills

Before starting, load and follow:

- `.app-info/skills/playwright-binary/SKILL.md` — local binary detection, spawn conventions, version parsing.
- `.app-info/skills/electron-ipc/SKILL.md` — IPC envelope pattern.
- `.app-info/skills/sqlite-migrations/SKILL.md` — migration runner conventions.
- `.app-info/skills/playwright-config-reader/SKILL.md` — dynamic testDir reading, config extraction.
- `.agents/skills/code-quality/SKILL.md` — shared code quality checklist.

## Goal

Create projects via wizard, check project health, detect Playwright version.

## Deliverables

### 1. Playwright Binary Helper (BUILD FIRST — everything else depends on this)
Implement `src/main/utils/playwrightBinary.ts` (see blueprint section 7):
- `getPlaywrightBinary(rootPath): string` → `node_modules/.bin/playwright` on macOS/Linux, `node_modules/.bin/playwright.cmd` on Windows
- `spawnPlaywright(args, rootPath, extraEnv?): ChildProcess` → spawn with `shell: false`
- `getPlaywrightVersion(rootPath): string` → `execFileSync(['--version'])`, extract version number

### 2. ProjectTemplateService
Wizard parameters: `projectName`, `rootPath`, `browsers[]`, `includeExampleTests`, `includeAuth`, `includePageObjects`, `includeFixtures`

Generated structure:
- `package.json` with `@playwright/test`
- `playwright.config.ts` configured with chosen browsers
- `tests/` (always), `pages/` (if includePageObjects), `fixtures/` (if includeFixtures)
- `environments/local.json` template
- `.pwstudio/project.json` with defaults (see blueprint section 6)

Conflict check: if `rootPath` already contains `playwright.config.*` → throw `ConflictError` with message "folder already contains a Playwright project".
After generation: `npm install` via `child_process.exec` in `rootPath`.

### 3. ProjectHealthService
Implement all checks (see blueprint section 12 — Service Boundaries — ProjectHealthService):
- `node`: `execFile('node', ['--version'])`, minimum 18.x
- `npm`: `execFile('npm', ['--version'])`
- `playwrightPackage`: check `node_modules/@playwright/test/package.json`
- `playwrightVersion`: `getPlaywrightVersion()`, minimum 1.40.0
- `playwrightConfig`: look for `playwright.config.ts` or `playwright.config.js`
- `configReadable`: `readPlaywrightConfig()` succeeded without fallback? (see blueprint section 8)
  → If readMethod === 'fallback': status = 'warning', message = "Config could not be read"
- `testDir`: `fs.existsSync(configSummary.testDir)` — use `configSummary.testDir`, NEVER hardcoded `tests/`
  → If configReadable = fallback: check testDir with warning
- `browserInstall`: `getPlaywrightBinary` + `['install', '--dry-run']`, exit code 0?

**PlaywrightConfigService:**
Also build `src/main/services/PlaywrightConfigService.ts` (see blueprint section 8).
Health checks use `configSummary.testDir`, not a hardcoded path.
All other services that need `testDir` request it via `PlaywrightConfigService`.

**Cache strategy:**
- Store snapshot in `project_health_snapshots` (extend migration 1 or migration 2)
- Cache valid for 1 hour
- Invalidated when FileWatchService reports `playwright.config.*` change
- Invalidated when user clicks "Refresh"

`HealthItem` has an `actionHint` field: e.g. "Run: npx playwright install"

### 4. Project Open Flow
When opening a project:
1. Load project from registry
2. Does `rootPath` exist? If not → `ProjectNotFoundError`
3. Health check (from cache if < 1 hour old)
4. Load `.pwstudio/project.json`, create if missing
5. Update `lastOpenedAt` in SQLite

### 5. IPC Handlers
Channels: `projects:create` (wizard → create + register), `health:get` (fetch cached), `health:refresh` (force new check)

On wizard conflict (existing `playwright.config.*`):
Return: `{ error: { code: 'PROJECT_EXISTS', message: '...' } }`
UI then asks: "Import instead of create?"

### 6. UI: Project Creation Wizard (4 steps)
1. Name + root path (directory picker)
2. Browser selection (checkboxes: chromium / firefox / webkit)
3. Options (examples / auth / page objects / fixtures)
4. Overview + confirm

Progress indicator during creation + npm install.

### 7. UI: Health Panel (on project dashboard)
- Per check: icon (pass / warning / error) + message + actionHint
- Show Playwright version as value
- "Refresh" button → `health:refresh`
- When status is 'error': run buttons disabled
- "Force run (ignore health)" link — small, inconspicuous, but functional

## Exit Criteria

- Creating a new project via wizard works (including npm install).
- Importing an existing project works.
- Health checks visible after opening.
- Run buttons disabled on error status.
- Force run escape present.
