# PHASE 1 — Foundation

## First Step

1. Read `.agents/AGENTS.md`.
2. Read `.agents/FRAMEWORK.md`.
3. Read `.app-info/ROUTING.md`.
4. Read `.app-info/docs/PW_STUDIO_BLUEPRINT.md` — the full architecture reference.

## Agent Routing

Per AGENTS.md routing rules, this phase involves:
- **Architect** — design the service container, IPC structure, and database schema.
- **Developer** — implement backend: SQLite, services, IPC handlers, main process.
- **Designer** — implement frontend: React UI, routing, project list screen.
- **Tester** — validate that all exit criteria are met.

Sequence: Architect → Developer → Designer → Tester.

## Required Skills

Before starting, load and follow:

- `.app-info/skills/electron-react-scaffold/SKILL.md` — Electron + React + TypeScript project structure, electron-vite config, TypeScript tsconfig split.
- `.app-info/skills/electron-ipc/SKILL.md` — IPC envelope pattern, preload/contextBridge conventions, handler registration.
- `.app-info/skills/sqlite-migrations/SKILL.md` — better-sqlite3 setup, migration runner, pragmas, native module handling.
- `.app-info/skills/path-safety/SKILL.md` — cross-platform path rules (applied from Phase 1 onwards).
- `.agents/skills/code-quality/SKILL.md` — shared code quality checklist.

## Goal

A working Electron + React app with SQLite, project registry, and a fully set up IPC system that serves as the foundation for all subsequent phases.

## Deliverables

### 1. Project Scaffolding
- Scaffold with `electron-vite` using the react-ts template
- electron-builder configuration (basic — full packaging in Phase 7)
- TypeScript strict mode with separate tsconfigs: `tsconfig.node.json` (main + preload, NO DOM), `tsconfig.web.json` (renderer, NO Node)
- Development workflow: `npm run dev` (electron-vite dev), `npm run build` (electron-vite build)
- Directory structure: `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`
- `electron.vite.config.ts` with `externalizeDepsPlugin()` for main/preload

### 2. Preload / contextBridge (CRITICAL — get this right first)
Implement the preload script exactly as described in the blueprint (section 4):
- `window.api.invoke(channel, payload)` → `ipcRenderer.invoke`
- `window.api.on(channel, handler)` → `ipcRenderer.on`
- `window.api.off(channel, handler)` → `ipcRenderer.removeListener`

All three must be present. `off()` is used in useEffect cleanup.

**Type declaration for renderer** — create `src/preload/index.d.ts` (or `src/renderer/src/env.d.ts`) so the renderer has typed access to `window.api`:
```typescript
declare global {
  interface Window {
    api: {
      invoke: <T>(channel: string, payload?: unknown) => Promise<IpcEnvelope<T>>
      on: (channel: string, handler: (data: unknown) => void) => void
      off: (channel: string, handler: (data: unknown) => void) => void
    }
  }
}
```

### 3. IpcEnvelope Type + IPC Constants
In `src/shared/types/ipc.ts`:
- `type IpcEnvelope<T> = { version: 1; payload?: T; error?: { code: string; message: string } }`
- **ALL** IPC channels as `const IPC = { ... }` object — the complete list from blueprint section 4, including channels for future phases (health, explorer, runs, environments, secrets, recorder, artifacts). Handlers are registered incrementally per phase, but the channel constants are defined upfront.
- Add utility channel: `DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory'` — needed for the directory picker in the renderer.

### 4. SQLite Bootstrap with Migrations
- Install `better-sqlite3` and `@electron/rebuild`
- `postinstall` script: `electron-rebuild`
- Database location: `path.join(app.getPath('userData'), 'pw-studio.db')` — using `path.join()`, not string concatenation
- Recommended pragmas: WAL mode, busy_timeout, synchronous=NORMAL, foreign_keys=ON (see sqlite-migrations skill)
- `schema_version` table created via `db.exec()` BEFORE `runMigrations()`
- Migration 1: `projects` table, `app_settings` table, `project_health_snapshots` table (all three — health snapshots needed in Phase 2)

### 5. ServiceContainer
A simple dependency injection container:
```typescript
// src/main/services/ServiceContainer.ts
export type ServiceContainer = {
  db: Database.Database
  win: BrowserWindow
  projectRegistry: ProjectRegistryService
  // Future services added here per phase
}

export function createServices(db: Database.Database, win: BrowserWindow): ServiceContainer {
  const projectRegistry = new ProjectRegistryService(db)
  return { db, win, projectRegistry }
}
```

This is NOT a framework — just a plain object holding service instances with their dependencies wired up. Extended each phase as new services are added.

### 6. ProjectRegistryService
- `addProject(name, rootPath, source)` / `importProject(rootPath)` / `listProjects()` / `getProject(id)` / `openProject(id)` / `removeProject(id)`
- Registry = metadata + paths, no source files
- `importProject` checks that `rootPath` exists and is a directory
- Generate UUID for project IDs (`crypto.randomUUID()`)
- Store `createdAt`, `updatedAt`, `lastOpenedAt` as ISO 8601

### 7. IPC Handlers for Projects
All handlers in `src/main/ipc/` as separate files per domain.
Always use `IpcEnvelope` wrapper for responses (including errors).

Channels implemented in this phase:
- `projects:list`, `projects:create`, `projects:import`, `projects:get`, `projects:open`, `projects:remove`
- `dialog:openDirectory` — wraps `dialog.showOpenDialog({ properties: ['openDirectory'] })` and returns the selected path

Handler registration:
```typescript
// src/main/ipc/index.ts
export function registerAllHandlers(services: ServiceContainer): void {
  registerProjectHandlers(services)
  registerDialogHandlers(services)
}
```

### 8. Basic React UI
- **Router:** `react-router-dom` with `HashRouter` (works with Electron's `file://` protocol)
- **Routes:** `/` (project list), `/project/:id` (project detail placeholder)
- **Projects screen:** project list from `projects:list`, "New project" button, "Import project" button
- **Directory picker:** calls `window.api.invoke(IPC.DIALOG_OPEN_DIRECTORY)` — returns path from main process
- **Empty project detail screen** (placeholder for Phase 2+)
- **Content Security Policy** meta tag in `index.html` (relaxed in dev, strict in prod — electron-vite handles this)

### 9. Basic Settings
- `app_settings` table (key-value, value JSON-encoded)
- Store `defaultWorkspacePath` (default: `app.getPath('documents')`)
- No settings UI in Phase 1 — just the table and service method

## Technical Requirements

- No hardcoded paths — always `path.join()` and `app.getPath()` (see path-safety skill)
- IPC handlers only in main, renderer uses only `window.api`
- TypeScript strict mode, no `any`
- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` on BrowserWindow

## Service Initialisation (mandatory pattern)

Initialisation order in `src/main/index.ts`:
1. `app.whenReady()` — ensures `app.getPath()` is available
2. `openDatabase()` → creates `schema_version` table via `db.exec()`, then runs `runMigrations()`
3. `createWindow()` → create BrowserWindow with security settings
4. `createServices(db, win)` → create all services with dependencies
5. `registerAllHandlers(services)` → register IPC handlers
6. Load the renderer URL (dev) or file (prod)

**CRITICAL:** `openDatabase()` must create `schema_version` BEFORE `runMigrations()`. The runner does `SELECT MAX(version)` — that table must already exist.

## Implementation Order

1. Directory structure + `package.json` + `electron.vite.config.ts` + tsconfigs
2. `src/shared/types/ipc.ts` (IpcEnvelope + ALL IPC channel constants)
3. `src/preload/index.ts` (contextBridge) + type declaration
4. `src/main/db/` (openDatabase + runMigrations + migration 1)
5. `src/main/services/ServiceContainer.ts`
6. `src/main/services/ProjectRegistryService.ts`
7. `src/main/index.ts` (app.whenReady + initialisation order)
8. `src/main/ipc/projectHandlers.ts` + `src/main/ipc/dialogHandlers.ts`
9. `src/renderer/` (HashRouter, project list, directory picker)

## Exit Criteria

- App starts successfully via `npm run dev`.
- Project creation (name + folder via directory picker) works.
- Importing an existing folder works.
- Projects survive restart (persisted in SQLite).
- ServiceContainer and IPC structure are locked in for all subsequent phases.
- All IPC channel constants defined (even those used in later phases).
- TypeScript compiles with zero errors in strict mode.
- BrowserWindow has correct security settings (sandbox, contextIsolation, no nodeIntegration).
