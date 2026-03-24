# FEATURE REGISTRY — PW Studio v1

## Phase 1 — Foundation

| Feature | Status | Notes |
|---|---|---|
| Electron shell + React renderer | planned | |
| SQLite + migrations system | planned | |
| Preload / contextBridge / IPC envelope | planned | |
| IPC channel constants | planned | |
| Project registry (create/import/list) | planned | |
| Basic app settings | planned | |

## Phase 2 — Project Lifecycle + Health

| Feature | Status | Notes |
|---|---|---|
| Project creation wizard (with conflict check) | planned | |
| Template generation | planned | |
| Project open flow | planned | |
| Health checks with cache strategy | planned | |
| Playwright version detection | planned | |
| Health Panel + Force Run escape | planned | |

## Phase 3 — Explorer

| Feature | Status | Notes |
|---|---|---|
| chokidar file watching | planned | |
| ProjectIndexService (full rebuild) | planned | |
| File tree UI | planned | |
| Test file detection | planned | |
| Regex testcase extraction | planned | |
| Parse warnings | planned | |

## Phase 4 — Run Engine

| Feature | Status | Notes |
|---|---|---|
| Local binary detection | planned | |
| CLI command builder | planned | |
| Single active run (spawn) | planned | |
| Log streaming | planned | |
| Cancel flow (SIGTERM → SIGKILL) | planned | |
| Run history | planned | |
| Run detail basics | planned | |

## Phase 5 — Artifact Layer

| Feature | Status | Notes |
|---|---|---|
| ArtifactService | planned | |
| File artifact policies (migration 3) | planned | |
| Artifact policy → CLI flags mapping | planned | |
| Rerun failed tests | planned | |
| Run detail artifacts tab | planned | |

## Phase 6 — Environments + Secrets + Recorder

| Feature | Status | Notes |
|---|---|---|
| EnvironmentService + watcher invalidation | planned | |
| SecretsService (keytar) | planned | |
| Temporary run overrides | planned | |
| RecorderService (codegen) | planned | |

## Phase 7 — Packaging + Polish

| Feature | Status | Notes |
|---|---|---|
| Windows .exe (electron-builder) | planned | |
| Path audit (no hardcoded paths) | planned | |
| IpcEnvelope.error per service | planned | |
| SQLite location in Settings | planned | |
| Documentation | planned | |
| Sample project | planned | |
