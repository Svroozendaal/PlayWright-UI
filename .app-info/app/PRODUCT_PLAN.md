# PRODUCT PLAN — PW Studio v1

## Build Phases

### Phase 1 — Foundation
Express server, React SPA, SQLite + migrations system, REST API + WebSocket transport, shared route constants in `src/shared/types/ipc.ts`, project registry, basic settings, and a browser-based folder picker.
**Milestone:** App starts in the browser. API structure is locked. Project creation and registration works.

### Phase 2 — Project Lifecycle + Health
Wizard (with conflict check on existing folder), template generation, project open flow, health checks with cache strategy, Playwright version detection via local binary, Health Panel + Force Run escape.
**Milestone:** Project import and health checks are visible through the web UI.

### Phase 3 + 4 — Explorer + Run Engine (parallel start)
**Phase 3:** chokidar (including environment + config cache invalidation), `ProjectIndexService` (full rebuild), file tree, test file detection, regex test case extraction, parse warnings.
**Phase 4:** Local binary detection, CLI command builder, single active run via `spawn()`, log streaming over WebSocket, cancel flow, run history, run detail basics.
**Milestone:** Explorer is live, one test file can be run, and exit code plus log are visible.

### Phase 5 — Artifact Layer
`ArtifactService`, `file_artifact_policies` (migration 3), `parentRunId` + `safeTitleForGrep` (migration 3), artifact policy to CLI flags, `rerunFailed`, run detail artifacts tab.
**Milestone:** Artifacts are configurable per file and rerun failed works.

### Phase 6 — Environments + Secrets + Recorder
`EnvironmentService` + watcher invalidation, `SecretsService` (`keytar`), temporary run overrides, `RecorderService` (recorder output -> watcher -> explorer refresh automatically), and browser-based save path selection.
**Milestone:** Environment with secret retrieval in run and recording save flow both work.

### Phase 7 — Packaging + Polish
`npm` install/start flow, zipped Node distribution, PWA manifest, path audit (no hardcoded paths), `ApiEnvelope.error` worked out per service, SQLite location shown in Settings, documentation, sample project.
**Milestone:** PW Studio v1 is installable via `npm` or a bundled local runtime.

## Definition of Done — v1

PW Studio v1 is complete when a user can:

1. Create a new project via wizard
2. Import an existing Playwright project
3. Immediately see if the project is healthy
4. See tests in a live explorer (folders, files, test cases)
5. Run a test/file/folder/all with the local binary
6. Review logs and test results per run
7. Configure artifacts per file and open them directly
8. Manage environments with encrypted secrets
9. Provide temporary run overrides
10. Start and save codegen recordings
11. Install the app via `npm` or a bundled local runtime
12. See the SQLite database location in Settings

## First Milestone

> "Open an imported Playwright project, pass health checks, show a live explorer that refreshes on file changes, and run one test file with the local Playwright binary while viewing exit code and log in the browser UI."
