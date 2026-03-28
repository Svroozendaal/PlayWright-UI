# PW STUDIO BLUEPRINT

## 1. Product Goal

PW Studio v1 is a local web application that wraps Playwright Test with a GUI. A local Node.js server provides the API, WebSocket events, database access, filesystem operations, and process orchestration. The browser UI is the only client. PW Studio is an orchestration layer around Playwright, not a replacement for it.

## 2. Product Boundaries

- Runs locally on the developer's machine
- Exposes HTTP and WebSocket interfaces on `127.0.0.1`
- Does not provide a cloud, multi-user, or remote-access model in v1
- Preserves file editing, test execution, environment management, recorder flows, and artifact handling

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Local server | Express + TypeScript |
| UI | React + TypeScript |
| Realtime push | WebSocket (`ws`) |
| Database | SQLite (`better-sqlite3`) |
| File watching | chokidar |
| Secrets | `keytar` |
| Automation | Local Playwright binary |
| Packaging | `npm` + bundled Node runtime |

## 4. Transport Architecture

### 4.1 Request/Response

All request/response communication goes through REST endpoints under `/api`.

Transport wrapper:

```ts
export type ApiEnvelope<T> = {
  version: 1
  payload?: T
  error?: { code: string; message: string }
}

export type IpcEnvelope<T> = ApiEnvelope<T>
```

Rules:

- Every route returns an envelope
- Route handlers validate params, query, and body at the boundary
- Known failures map to `ERROR_CODES`
- Unknown failures return `UNKNOWN` without leaking internals

### 4.2 Push Events

Push communication uses a single WebSocket endpoint at `/ws`.

Event payload shape:

```ts
type SocketMessage = {
  channel: string
  data: unknown
}
```

Rules:

- One shared socket connection per browser session
- Existing event names are preserved where practical
- Services broadcast events through a `broadcast(channel, data)` function
- The same events are also emitted internally through a server `EventEmitter` for plugins

### 4.3 Shared Contracts

Shared transport and domain types stay in `src/shared/types/ipc.ts` during the migration. The file continues to hold:

- `ApiEnvelope<T>` and temporary `IpcEnvelope<T>` alias
- `API_ROUTES`
- `WS_EVENTS`
- `ERROR_CODES`
- Domain types such as `RegisteredProject`, `HealthSnapshot`, `RunRecord`, and `ExplorerNode`

## 5. Security Model

- Bind HTTP and WebSocket listeners to `127.0.0.1`
- Allow CORS only for the Vite dev origin in development
- Use same-origin access in production
- Never expose plaintext secrets to the browser
- Keep filesystem and process access server-side only
- Validate all user-controlled input before using it in filesystem, SQL, or shell boundaries

## 6. API Surface

Core route groups:

- `/api/projects`
- `/api/directories`
- `/api/settings`
- `/api/projects/:id/health`
- `/api/projects/:id/explorer`
- `/api/projects/:id/runs`
- `/api/runs`
- `/api/artifacts`
- `/api/projects/:id/environments`
- `/api/secrets`
- `/api/projects/:id/recorder`
- `/api/files`
- `/api/projects/:id/flaky`
- `/api/projects/:id/dashboard`
- `/api/openapi.json`
- `/api/plugins/:pluginName/*`

OpenAPI is generated from the same route registry used to register handlers and validation schemas.

## 7. Frontend Architecture

The renderer is a React SPA served by Vite in development and by the local server in production.

Rules:

- Use `BrowserRouter`
- Call the backend through `src/renderer/src/api/client.ts`
- Subscribe to push events through `src/renderer/src/api/useSocket.ts`
- Replace native dialogs with in-app browser components
- Keep UI state local unless state sharing is clearly necessary

Primary screens:

- Projects
- Dashboard
- Explorer
- Runs
- Run Detail
- Run Comparison
- Environments
- Recorder
- Settings
- Flaky Tests

## 8. Backend Architecture

The server is split into four layers:

1. **Routes** — HTTP endpoint registration and request validation
2. **Services** — business logic and orchestration
3. **Database** — SQLite access and migrations
4. **Infrastructure** — WebSocket server, plugin loader, OpenAPI generation, static asset serving

### 8.1 Service Container

`ServiceContainer` wires together long-lived services and shared runtime dependencies:

- `db`
- `broadcast`
- `events`
- domain services such as project registry, health, index, run, artifact, secrets, environment, recorder, dashboard

### 8.2 Event Sources

Important server-originated events:

- `runs:statusChanged`
- `runs:logEvent`
- `explorer:refresh`
- `environments:changed`
- `health:refresh`
- `recorder:status`

## 9. File Dialog Replacements

Native desktop dialogs are replaced with browser-based components backed by server APIs.

### 9.1 Folder Picker

- Calls `POST /api/directories/browse`
- Browses from home directory or Documents by default
- Supports breadcrumb navigation and directory selection

### 9.2 Save File Flow

- Uses directory browsing plus explicit filename input
- Recorder flow stores directory and filename separately in UI, then sends combined `outputPath` to the server
- No native save dialog in v1

## 10. Database

SQLite remains the system of record.

Database location:

- Windows: `%APPDATA%/pw-studio/pw-studio.db`
- macOS: `~/Library/Application Support/pw-studio/pw-studio.db`
- Linux: `~/.config/pw-studio/pw-studio.db`

Rules:

- Open one shared connection at server start
- Create `schema_version` before running migrations
- Keep migrations append-only
- Use WAL mode and prepared statements

## 11. Filesystem and Process Rules

- Use `path.join()` or `path.resolve()` for path construction
- Never hardcode `tests/`; use `configSummary.testDir`
- Spawn the local Playwright binary only
- Use `taskkill /T /F` on Windows when cancelling Playwright process trees
- Open artifacts via OS shell commands:
  - Windows: `start`
  - macOS: `open`
  - Linux: `xdg-open`

## 12. Plugins

Plugins are Node modules discovered from `~/.pw-studio/plugins` plus optional configured extra directories.

Plugin contract:

```ts
interface PwStudioPlugin {
  name: string
  version: string
  activate(ctx: PluginContext): void | Promise<void>
  deactivate?(): void | Promise<void>
  routes?(router: Router): void
  onEvent?(channel: string, data: unknown): void
}
```

Rules:

- Routes mount under `/api/plugins/:pluginName`
- Plugins receive typed service access through `PluginContext`
- No hot reload in v1; restart required

## 13. OpenAPI and AI/MCP Access

- `/api/openapi.json` exposes the local API contract
- The OpenAPI document is generated from the registered route schemas
- The REST API is the foundation for AI and MCP integrations
- Keep response shapes stable and deterministic

## 14. Project Structure

```text
pw-studio/
├── src/
│   ├── server/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── plugins/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── index.ts
│   │   └── ws.ts
│   ├── renderer/
│   │   ├── public/
│   │   └── src/
│   │       ├── api/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── App.tsx
│   │       └── main.tsx
│   └── shared/
│       └── types/
├── sample-project/
├── vite.config.ts
├── tsconfig.server.json
├── tsconfig.web.json
└── package.json
```

## 15. Runtime Start-Up

Start-up order:

1. Resolve runtime paths and open SQLite
2. Create shared `EventEmitter`
3. Create WebSocket server and `broadcast()` function
4. Create services
5. Load plugins
6. Register API routes
7. Register OpenAPI endpoint
8. Serve SPA assets or Vite-proxied frontend
9. Print local URL and wait for browser client connections

Shutdown order:

1. Stop watchers
2. Deactivate plugins
3. Close WebSocket server
4. Close HTTP server
5. Checkpoint and close SQLite

## 16. Build Phases

### Phase 1 — Foundation
Express server, React SPA, route constants, `ApiEnvelope`, project registry, settings bootstrap, folder browser.

### Phase 2 — Project Lifecycle + Health
Health routes, config extraction, project import/open flows, health panel.

### Phase 3 — Explorer
Watcher service, project indexing, tree rendering, file operations.

### Phase 4 — Run Engine
Run orchestration, log streaming, run history, run detail.

### Phase 5 — Artifacts
Artifact policy storage, rerun failed, report and trace open flows.

### Phase 6 — Environments + Secrets + Recorder
Environments, `keytar` secrets, recorder status push, browser save-path flow.

### Phase 7 — Packaging + Polish
`npm` package, bundled runtime, PWA manifest, OpenAPI, plugins, documentation.

## 17. Technical Debt

- Route validation and OpenAPI are introduced during the migration and should be kept in lockstep
- Plugin isolation is lightweight in v1; plugins run in-process
- Recorder file-save UX is browser-based rather than native
- Native dependencies still require platform-aware distribution and verification
- Full automated end-to-end coverage for browser-plus-server flows still needs expansion
