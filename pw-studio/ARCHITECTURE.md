# PW Studio — Architecture

## Overview

PW Studio is structured in four layers, following the Electron process model:

```
┌───────────────────────────────┐
│         Renderer (UI)         │  React + TypeScript
│   Pages, Components, Hooks    │  HashRouter, no Node access
├───────────────────────────────┤
│         Preload Bridge        │  contextBridge
│   window.api.invoke/on/off    │  IpcEnvelope wrapper
├───────────────────────────────┤
│       Main Process (Backend)  │  Node.js + TypeScript
│   Services, IPC Handlers, DB  │  All business logic here
├───────────────────────────────┤
│       System / OS Layer       │  SQLite, keytar, chokidar
│   File system, child_process  │  Playwright binary spawn
└───────────────────────────────┘
```

## Layer Responsibilities

### Renderer (React)
- Displays UI, handles user interaction.
- Communicates with main process exclusively via `window.api.invoke()` (request/response) and `window.api.on()`/`off()` (push events).
- No direct access to Node.js, file system, or database.
- Routes: Projects, Project Detail, Explorer, Runs, Run Detail, Settings.

### Preload
- Bridges renderer and main process via `contextBridge.exposeInMainWorld()`.
- Wraps all calls in the `IpcEnvelope` protocol (version, payload, error).
- Three methods: `invoke`, `on`, `off`.

### Main Process
- **ServiceContainer**: Dependency injection — plain object holding all service instances.
- **Services**: Business logic (ProjectRegistry, Health, FileWatch, ProjectIndex, Run, Artifact, Settings, etc.).
- **IPC Handlers**: One file per domain, registered centrally in `registerAllHandlers()`.
- **Database**: SQLite via better-sqlite3, WAL mode, migration runner.
- **Utils**: Playwright binary detection, config reader, result parser.

### System Layer
- **SQLite** (better-sqlite3): Persists projects, runs, test results, artifact policies, settings.
- **keytar**: OS keychain for secrets — no plaintext fallback.
- **chokidar**: File watching with debounce — triggers index rebuild and cache invalidation.
- **child_process**: Spawns Playwright binary for test runs and codegen.

## IPC Protocol

All communication uses `IpcEnvelope<T>`:
```typescript
type IpcEnvelope<T> = {
  version: 1
  payload?: T
  error?: { code: string; message: string }
}
```

Error codes are defined as constants in `ERROR_CODES`. Every IPC handler returns an envelope — never throws to the renderer.

## Database

Located at `app.getPath('userData')/pw-studio.db`. Three migrations:
1. `projects`, `app_settings`, `project_health_snapshots`
2. `runs`, `run_test_results`
3. `file_artifact_policies`, `parentRunId`, `safeTitleForGrep`

## Full Specification

See `.app-info/docs/PW_STUDIO_BLUEPRINT.md` for the complete architecture blueprint, including all IPC channels, database schema, service boundaries, and build phases.
