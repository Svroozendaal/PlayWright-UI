# PHASE 7 — Packaging + Polish

## First Step

1. Read `.agents/AGENTS.md`.
2. Read `.agents/FRAMEWORK.md`.
3. Read `.app-info/ROUTING.md`.
4. Read `.app-info/docs/PW_STUDIO_BLUEPRINT.md` — the full architecture reference.

## Agent Routing

Per AGENTS.md routing rules:
- **Developer** — electron-builder config, path audit, error codes, AI interface stub.
- **Designer** — error screens, settings UI, documentation.
- **Tester** — packaged build validation, path edge cases.
- **Documenter** — README, CONTRIBUTING, ARCHITECTURE docs.
- **Deployment** — build pipeline, release packaging.

Sequence: Developer → Designer → Documenter → Tester → Deployment.

## Prerequisites

Phase 1–6 are complete. The app is functionally complete for v1.

## Required Skills

Before starting, load and follow:

- `.app-info/skills/electron-builder-packaging/SKILL.md` — Windows .exe packaging, NSIS config, portable builds.
- `.app-info/skills/electron-ipc/SKILL.md` — IPC error code conventions.
- `.app-info/skills/path-safety/SKILL.md` — path audit checklist, cross-platform path rules.
- `.agents/skills/code-quality/SKILL.md` — shared code quality checklist.
- `.agents/skills/security-review/SKILL.md` — security checklist for packaging.
- `.agents/skills/documentation/SKILL.md` — documentation conventions.

## Goal

Build Windows .exe, finalise error states, write documentation.

## Deliverables

### 1. electron-builder for Windows
`electron-builder.yml`:
```yaml
appId: com.pwstudio.app
productName: PW Studio
directories:
  output: dist
win:
  target:
    - target: nsis
    - target: portable
  icon: resources/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

`package.json` scripts:
- `"build:win": "electron-builder --win"`
- `"build:win:portable": "electron-builder --win portable"`

Validate after build:
- App starts correctly after install
- SQLite database created in correct AppData folder
- No hardcoded paths in combined .exe

### 2. Path Audit
Search the entire codebase for:
- Backslash literals in strings (`'\\'` or `"\\"`)
- Hardcoded `'C:\\'` or `'/home/'` paths
- Path concatenation with `+` instead of `path.join()`

Correct alternatives:
- `path.join()` for all path construction
- `app.getPath('userData')` for app data
- `app.getPath('documents')` as default workspace suggestion
- Test all paths with: spaces, different drive letter (`D:\`), special characters

### 3. IpcEnvelope Error Codes
Define all error codes as constants:
```typescript
export const ERROR_CODES = {
  PROJECT_NOT_FOUND:        'PROJECT_NOT_FOUND',
  PROJECT_EXISTS:           'PROJECT_EXISTS',
  HEALTH_CHECK_FAILED:      'HEALTH_CHECK_FAILED',
  CONFIG_NOT_READABLE:      'CONFIG_NOT_READABLE',
  ACTIVE_RUN_EXISTS:        'ACTIVE_RUN_EXISTS',
  RUN_NOT_FOUND:            'RUN_NOT_FOUND',
  SECRETS_UNAVAILABLE:      'SECRETS_UNAVAILABLE',
  ENVIRONMENT_NOT_FOUND:    'ENVIRONMENT_NOT_FOUND',
  RECORDER_ALREADY_RUNNING: 'RECORDER_ALREADY_RUNNING',
} as const
```

Per service: all known errors return an `IpcEnvelope` with `error.code`.
UI has a usable message per `error.code`.

### 4. UI Error Screens
- `PROJECT_NOT_FOUND` → "Project not found on disk" + "Remove from list" button
- `HEALTH_CHECK_FAILED` (error status) → per check actionable explanation (use `actionHint`)
- `CONFIG_NOT_READABLE` → warning banner: "Playwright config could not be read. testDir falls back to 'tests/'. Check playwright.config.ts for syntax errors." + show readMethod in details for debugging
- `config-error` run status → Run Detail opens automatically on Logs tab, Summary shows "Playwright could not start" (not "X tests failed")
- `BASE_URL` hint → if `playwright.config.ts` does not contain `process.env`: Health Panel warning: "baseURL appears hardcoded — PW Studio cannot override it. Add process.env.BASE_URL to playwright.config.ts to use environments."
- `ACTIVE_RUN_EXISTS` → "There is already an active run. Wait until it finishes."
- `SECRETS_UNAVAILABLE` → "Keychain not available. [Windows: Credential Manager explanation]"
- `ENVIRONMENT_NOT_FOUND` → banner "Active environment not found, reset to none"
- File deleted while app is open → explorer shows file as 'error' state

### 5. SQLite Location Display
In Settings → App section:
"Database location: [path]" with copy button.
This is `app.getPath('userData') + '/pw-studio.db'`.
User can use this for backup or troubleshooting.

### 6. Documentation
**README.md:**
- What is PW Studio (2 sentences)
- Requirements: Node >= 18, npm, Playwright >= 1.40
- Installation (Windows installer)
- First steps: create or import project
- Screenshots of the 3 main screens

**CONTRIBUTING.md:**
- Development setup (`npm install`, `npm run dev`)
- Build instructions
- Directory structure explanation (references blueprint)
- How to add a new service
- How to add an IPC channel

**ARCHITECTURE.md:**
- Brief summary of the 4 architecture layers
- References `pw-studio-blueprint.md` for the full spec

### 7. Sample Project
A small working Playwright project to ship with the app:
- 3 simple tests that test Playwright's own demo app (playwright.dev/docs)
- `tests/smoke/` with 1 test, `tests/checkout/` with 2 tests
- `environments/local.json` with baseURL filled in
- `.pwstudio/project.json` present
- README: "Open this as your first project in PW Studio via 'Import project'"

### 8. AI Interface Preparation (do not implement)
Create the file but implement nothing:
```typescript
// src/main/ai/providers/TestGenerationProvider.ts
export interface TestGenerationProvider {
  generateTest(prompt: string, context: ProjectContext): Promise<GeneratedTest>
}
export type ProjectContext = { rootPath: string; testFiles: string[]; framework: 'playwright' }
export type GeneratedTest = { code: string; suggestedPath: string }
```

## Exit Criteria

- Windows installer and portable .exe available.
- App installs cleanly, data in AppData.
- All known error codes have a usable UI message.
- SQLite location visible in Settings.
- README gives new users a flying start.
- Sample project works out of the box.

---

**PW STUDIO V1 IS COMPLETE.**

Definition of Done check:
- New project creation via wizard (playwright.config.ts generated with process.env.BASE_URL)
- Existing project import
- Project health visible (with Force Run escape + configReadable check + dynamic testDir)
- Explorer with live refresh + graceful parse error handling
- Watch targets only on existing folders
- Tests runnable via local binary (file/folder/all browsers via BrowserSelection)
- Run dialog: activeEnvironment pre-selected, browser dropdown from configSummary.projects
- config-error distinguished from failed — Logs tab automatically opened
- Logs and test results reviewable
- Artifacts configurable per file (correct CLI flag mapping, paths from JSON reporter)
- rerunFailed with grep strategy and parentRunId (not offered for config-error)
- Environments + secrets (keytar, no plaintext fallback)
- BASE_URL injected as env var (not PLAYWRIGHT_BASE_URL)
- Temporary run overrides
- Codegen start and save → explorer refreshes automatically
- Windows .exe installable
- SQLite location visible in Settings
