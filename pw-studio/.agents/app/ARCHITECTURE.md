# ARCHITECTURE — PW Studio

## Runtime Model

```
Browser UI  →  API client + WebSocket  →  Express server  →  services  →  SQLite / filesystem / Playwright / keytar
```

The browser has no direct filesystem or Node.js access. All system operations go through the Express server.

## Transport

### REST API

All REST responses use the `ApiEnvelope<T>` pattern:

```ts
export type ApiEnvelope<T> = {
  version: 1
  payload?: T
  error?: { code: string; message: string }
}
```

Base path: `/api/`
OpenAPI spec: `/api/openapi.json`

### WebSocket

Push events are sent over `/ws` using:

```ts
type SocketMessage = {
  channel: string
  data: unknown
}
```

Plugins can also subscribe to these events internally via a server `EventEmitter` — no browser transport required.

### Shared Contracts

All shared types live in `src/shared/types/`:

- `ipc.ts` — `ApiEnvelope<T>`, `IpcEnvelope<T>` (compat alias), `API_ROUTES`, `WS_EVENTS`, `ERROR_CODES`
- Domain types, block-editor contracts, plugin manifests, and project plugin state

## Security Model

- Server binds to `127.0.0.1` only
- CORS allowed only for the Vite dev origin in development; same-origin in production
- Filesystem, process, and keychain access stays on the server
- All route params, query, and body data are validated at the boundary
- Secrets stored in the OS keychain via `keytar` — never in the database or filesystem

## Folder Map

| Path | Purpose |
|---|---|
| `src/server/` | Express server entry, route registration, WebSocket, plugin loader |
| `src/server/routes/` | REST route handlers (one file per domain) |
| `src/server/services/` | Business logic, Playwright runner, file services, recorder |
| `src/server/db/` | SQLite setup, migrations, and query helpers |
| `src/server/plugins/` | Plugin discovery, loading, and runtime |
| `src/server/middleware/` | Auth, error handling, and request validation |
| `src/server/utils/` | Shared server utilities (paths, process, config) |
| `src/renderer/src/pages/` | Top-level page components (one per route) |
| `src/renderer/src/components/` | Shared React components |
| `src/renderer/src/hooks/` | Custom React hooks |
| `src/shared/types/` | Shared TypeScript contracts |
| `plugins/` | Shipped local plugins (e.g., mendix-portable-workflow) |
| `resources/` | Static assets bundled at packaging time |

## Key Services (src/server/services/)

| Service | Responsibility |
|---|---|
| Project service | Project registry CRUD, config reading, health checks |
| Runner service | Playwright binary resolution and test execution |
| File service | File tree indexing, read/write, chokidar watcher |
| Recorder service | Playwright codegen launch, save, and transform pipeline |
| Block service | Block template registry (core + plugin + custom) |
| Environment service | Per-project environment variables and keytar secret access |
| Suite service | Suite definition storage and batch execution |

## Plugin System

Plugins are discovered from:

1. `~/.pw-studio/plugins/` (user global)
2. Optional configured extra directories
3. `pw-studio/plugins/` (shipped local plugins)

Project-level enablement is stored in `.pw-studio/plugins/<plugin-id>.json` inside the project folder.

Plugins can contribute:
- Recorder transforms
- Block definitions and templates
- Project setup hooks
- Additional routes
- UI metadata

## Database

SQLite via `better-sqlite3`. Schema is managed through sequential migration files. Key tables:

| Table | Purpose |
|---|---|
| `projects` | Registered project metadata |
| `runs` | Run history and results |
| `run_results` | Per-test results within a run |
| `artefacts` | Artefact paths and policy flags |
| `suites` | Suite definitions per project |
| `suite_runs` | Suite execution history |
| `settings` | Key-value application settings |

## Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start server and renderer in development mode |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checks |
