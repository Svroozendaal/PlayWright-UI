# PHASE 6 — Environments + Secrets + Recorder

## First Step

1. Read `.agents/AGENTS.md`.
2. Read `.agents/FRAMEWORK.md`.
3. Read `.app-info/ROUTING.md`.
4. Read `.app-info/docs/PW_STUDIO_BLUEPRINT.md` — the full architecture reference.

## Agent Routing

Per AGENTS.md routing rules:
- **Developer** — EnvironmentService, SecretsService, RecorderService, run overrides.
- **Designer** — Environment manager UI, recorder screen.
- **Tester** — validate secret encryption, environment resolution, recorder flow.

Sequence: Developer → Designer → Tester.

## Prerequisites

Phase 1–5 are complete.

## Required Skills

Before starting, load and follow:

- `.app-info/skills/keytar-secrets/SKILL.md` — OS keychain integration, secret storage patterns.
- `.app-info/skills/electron-ipc/SKILL.md` — IPC envelope pattern, push events.
- `.app-info/skills/chokidar-watcher/SKILL.md` — environment file watcher invalidation.
- `.app-info/skills/playwright-binary/SKILL.md` — codegen command, recorder spawn.
- `.agents/skills/security-review/SKILL.md` — security checklist for secrets handling.
- `.agents/skills/code-quality/SKILL.md` — shared code quality checklist.

## Goal

Safely manage environments and secrets. Integrate recorder/codegen.

## Deliverables

### 1. EnvironmentService
Environments as JSON files in `<rootPath>/environments/*.json`.

Format (see blueprint section 12 — EnvironmentService):
```json
{
  "name": "staging",
  "baseURL": "https://staging.example.com",
  "variables": { "LOGIN_EMAIL": "test@example.com" },
  "secretRefs": { "LOGIN_PASSWORD": "pwstudio://project/<id>/staging/LOGIN_PASSWORD" }
}
```

Methods:
- `listEnvironments(projectId): Environment[]`
- `saveEnvironment(projectId, env): void` → write to `environments/<name>.json`
- `deleteEnvironment(projectId, name): void` → delete JSON + all secrets via SecretsService
- `resolveForRun(projectId, envName, overrides?): ResolvedEnv`

**resolveForRun steps:**
1. Load environment JSON
2. Resolve all secretRefs via `SecretsService.getSecret()`
3. Merge with overrides (overrides always win):
   - `overrides.baseURL` overrides `env.baseURL`
   - `overrides.env` merges on top of `env.variables` + resolved secrets
4. Returns: `{ baseURL: string, env: Record<string, string> }`

**Integrate into RunService.startRun():**
If `request.environmentName` is present:
  `resolvedEnv = await EnvironmentService.resolveForRun(...)`
  Pass as `extraEnv` to `spawnPlaywright()`.

**BASE_URL mechanism (see blueprint section 12 — EnvironmentService):**
Inject baseURL as `BASE_URL` env var (NOT as `PLAYWRIGHT_BASE_URL`):
  `extraEnv.BASE_URL = resolvedEnv.baseURL`
This only works if the user project reads `process.env.BASE_URL` in `playwright.config.ts`.
For wizard-generated projects: always generated with `process.env.BASE_URL`.
For imported projects: show hint in Health Panel if baseURL appears hardcoded
  (detect: `playwright.config.ts` does not contain `process.env` → warning "baseURL env var not read").

**Cache invalidation:** FileWatchService sends `ENVIRONMENTS_CHANGED` on changes in `environments/` → `EnvironmentService.invalidateCache(projectId)`.

**Reconciliation:** If `projects.activeEnvironment` does not exist as JSON → reset to null, push banner event to renderer.

### 2. SecretsService
`npm install keytar`

Keychain configuration:
- service: `"pw-studio"`
- account format: `"project/<projectId>/<envName>/<varName>"`

Methods:
- `setSecret(projectId, envName, key, value): Promise<void>`
- `getSecret(projectId, envName, key): Promise<string | null>`
- `deleteSecret(projectId, envName, key): Promise<void>`
- `checkAvailability(): Promise<boolean>`

**CRITICAL:** If keychain is not available:
- Throw `SecretsUnavailableError` with clear message
- Never silently fall back to plaintext storage
- UI shows: "Keychain not available. [explanation per OS]"

### 3. Full Run Overrides Implementation
`RunRequest.overrides` was already present (Phase 4).
Now fully integrate into `startRun()`:
- `overrides.baseURL` → `BASE_URL` env var (see EnvironmentService section above)
- `overrides.env` → merge into extraEnv
- `overrides.headed` → `--headed` arg
- `overrides.debug` → `--debug` arg
- `overrides.retries` → `--retries=N` arg

### 4. IPC Handlers
- `environments:list`, `environments:create`, `environments:update`, `environments:delete`
- `secrets:set`, `secrets:getMasked` (returns "••••••" not the real value), `secrets:delete`
- `recorder:start`, `recorder:stop`, `recorder:save`

### 5. UI: Environment Manager (in Settings → Project tab)
- List of environments
- Create / edit / delete
- Per environment form:
  - Name + baseURL
  - Variables section: key-value editor (plaintext)
  - Secrets section: key-value editor (masked, save via `secrets:set`)
  - "Test connection" is out of scope for v1
- Active environment selection: dropdown in project dashboard
  - Current value = `projects.activeEnvironment` from SQLite
  - Change → `UPDATE projects SET activeEnvironment` + immediate effect on next run
  - "No environment" is always a valid option (= null)
  - On reconciliation error (environment JSON deleted): dropdown shows "Not found — reset"

### 6. RecorderService
Starts Playwright codegen in external browser window (not embedded in v1).

```typescript
type CodegenOptions = {
  startUrl?: string
  outputPath: string   // Full path to target file
  browser?: string
}
```

Methods:
- `startCodegen(projectId, options): Promise<void>` — check: no active run or codegen session. Command: `spawnPlaywright(['codegen', '--output=<outputPath>', '<startUrl>'], rootPath)`. Store current session in memory. Push `RECORDER_STATUS: { status: 'running' }`.
- `stopCodegen(): Promise<void>` — kill the codegen process. Push `RECORDER_STATUS: { status: 'idle' }`.
- `saveOutput(targetPath): Promise<void>` — codegen already writes to outputPath during recording. After `stopCodegen`: check if outputPath exists. FileWatchService picks up the new file automatically → Explorer refreshes.
- `getStatus(): 'idle' | 'running'`

Limitation v1: one session at a time. App restart ends session. No getStatus persistence across restarts.

### 7. UI: Recorder Screen
- Start URL input field (optional)
- Output folder picker: directory picker restricted to `configSummary.testDir` of the project. (Fetch testDir via `PlaywrightConfigService.get(projectId).testDir` — NOT hardcoded `tests/`)
- Filename input field (default: `"recorded-test.spec.ts"`)
- Browser dropdown
- "Start Recording" button → `recorder:start`
- Status indicator: idle / recording (pulsating indicator)
- "Stop Recording" button → `recorder:stop`
- After stop: show file path, "Open in Explorer" link

## Exit Criteria

- Create environment with plaintext variables + encrypted secret.
- During run, environment is loaded and secrets fetched from keychain.
- Temporary baseURL and env var overrides work in run dialog.
- Start recorder → browser opens → stop recording → file appears in explorer.
