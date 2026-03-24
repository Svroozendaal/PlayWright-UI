# PRODUCT PLAN — PW Studio v1

## Build Phases

### Phase 1 — Foundation
Electron shell, React renderer, SQLite + migrations system, preload/contextBridge fully set up, IPC constants in `shared/types/ipc.ts`, project registry, basic settings.
**Milestone:** App starts. IPC structure is locked. Project creation and registration works.

### Phase 2 — Project Lifecycle + Health
Wizard (with conflict check on existing folder), template generation, project open flow, health checks with cache strategy, Playwright version detection via local binary, Health Panel + Force Run escape.
**Milestone:** Project import, health checks visible.

### Phase 3 + 4 — Explorer + Run Engine (parallel start)
**Phase 3:** chokidar (incl. environment + config cache invalidation), ProjectIndexService (full rebuild), file tree, test file detection, regex testcase extraction, parse warnings.
**Phase 4 (PoC parallel):** Local binary detection, CLI command builder, single active run via spawn(), log streaming, cancel flow, run history, run detail basics.
**Milestone:** Explorer live + run one test file, see exit code and log.

### Phase 5 — Artifact Layer
ArtifactService, file_artifact_policies (migration 3), parentRunId + safeTitleForGrep (migration 3), artifact policy → CLI flags, rerunFailed, run detail artifacts tab.
**Milestone:** Artifacts configurable per file, rerun failed works.

### Phase 6 — Environments + Secrets + Recorder
EnvironmentService + watcher invalidation, SecretsService (keytar), temporary run overrides, RecorderService (recorder output → watcher → explorer refresh automatically).
**Milestone:** Environment with secret retrieval in run, recording save.

### Phase 7 — Packaging + Polish
Windows .exe (electron-builder), path audit (no hardcoded paths), IpcEnvelope.error worked out per service, SQLite location shown in Settings, documentation, sample project.
**Milestone:** PW Studio v1 installable as .exe.

## Definition of Done — v1

PW Studio v1 is complete when a user can:

1. Create a new project via wizard
2. Import an existing Playwright project
3. Immediately see if the project is healthy
4. See tests in a live explorer (folders, files, testcases)
5. Run a test/file/folder/all with the local binary
6. Review logs and test results per run
7. Configure artifacts per file and open them directly
8. Manage environments with encrypted secrets
9. Provide temporary run overrides
10. Start and save codegen recordings
11. Install the app as a Windows `.exe`
12. See the SQLite database location in Settings

## First Milestone

> "Open imported Playwright project, pass health checks, show live explorer that refreshes on file changes — and run one test file with the local Playwright binary, see exit code and log."
