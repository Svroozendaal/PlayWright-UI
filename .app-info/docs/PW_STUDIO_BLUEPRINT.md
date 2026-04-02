# PW STUDIO BLUEPRINT

## 1. Product Goal

PW Studio is a local web application for Playwright Test. A local Node.js server exposes HTTP and WebSocket interfaces, manages the database and filesystem, runs Playwright, and hosts a browser UI on the same machine.

The application is an orchestration layer around Playwright, not a replacement for it.

## 2. Product Boundaries

- Local-only runtime on the developer's machine
- HTTP and WebSocket listeners bind to `127.0.0.1`
- No cloud-hosted, multi-user, or remote execution model in v1
- `.spec.ts` files remain the only executable and persisted test format
- Visual block editing is an authoring layer only

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Local server | Express + TypeScript |
| Browser UI | React + TypeScript |
| Realtime push | WebSocket (`ws`) |
| Database | SQLite (`better-sqlite3`) |
| Secrets | `keytar` |
| File watching | `chokidar` |
| Automation | local Playwright binary |
| Packaging | `npm` + bundled Node runtime |

## 4. Transport Architecture

### 4.1 Request/Response

All route responses use the envelope pattern:

```ts
export type ApiEnvelope<T> = {
  version: 1
  payload?: T
  error?: { code: string; message: string }
}
```

`IpcEnvelope<T>` remains a temporary alias in shared types for compatibility.

### 4.2 Push Events

Push events are sent over `/ws` with:

```ts
type SocketMessage = {
  channel: string
  data: unknown
}
```

The same events are also emitted internally through a server `EventEmitter` so plugins can subscribe without talking through the browser transport.

### 4.3 Shared Contracts

`src/shared/types/ipc.ts` contains:

- `ApiEnvelope<T>` and `IpcEnvelope<T>`
- `API_ROUTES`
- `WS_EVENTS`
- `ERROR_CODES`
- domain types
- block-editor contracts
- plugin manifests and project plugin state

## 5. Security Model

- Bind to `127.0.0.1`
- Allow CORS only for the Vite dev origin in development
- Use same-origin behaviour in production
- Keep filesystem, process, and keychain access on the server
- Validate route params, query, and body data at the boundary

## 6. Runtime Topology

```text
Browser UI -> API client + WebSocket -> Express server -> services -> SQLite / filesystem / Playwright / keytar
```

The browser has no direct filesystem or Node access.

## 7. Core Application Areas

### 7.1 Projects

- create projects
- import existing Playwright projects
- store registry metadata without moving project folders

### 7.2 Health

- validate Node, npm, Playwright, browsers, and project config
- expose config summaries such as `testDir`, browser projects, and output directory

### 7.3 Explorer and Editing

- index test files and test cases
- open and save files
- expose test-case metadata with stable `TestCaseRef`
- support both code editing and visual block editing

### 7.4 Runs

- run folders, files, and specific tests
- support headed mode and run options
- stream logs in realtime
- store run history, test results, and artefact paths
- store run comparison data for side-by-side result viewing
- access HTML reports directly from run detail
- pause and resume recording during test runs

### 7.4a Suites

Batch test execution with grouped, configured test suites:

- store suite definitions per project with named test sets
- configure run options and filters per suite
- execute suites to run multiple grouped test configurations
- rerun failed tests from a suite
- view suite run history and results

### 7.5 Recorder

- run Playwright codegen
- save output to a normal file
- refine code through the recorder transform pipeline
- surface suggestions and extracted values in the UI

### 7.6 Block Authoring

The visual test editor:

- loads one selected `test(...)`
- maps supported statements into blocks
- keeps unsupported statements as raw code blocks
- saves back into the source file
- reparses code edits back into blocks
- caches visual documents locally for faster reloads
- supports constants blocks for leading const declarations at the test scope
- supports block parameters and flow input/output mapping for test-to-test data passing
- supports subflows for invoking other tests with parameter passing

The file remains the only runnable source of truth.

Block features:

- **Constants block**: groups const declarations at the top of test body with syntax validation
- **Parameters**: blocks may accept configurable input fields exposed in the UI
- **Subflows**: test blocks that invoke other tests (marked with `pw-studio-subflow:` prefix) and pass parameters
- **Flow input definitions**: define what parameters a test accepts and how they are used
- **Flow input mapping**: configure which constants or block outputs feed into subflow inputs

### 7.7 Block Library

The block library is global and file-backed. It combines:

- core built-in block templates
- plugin-contributed block templates
- custom templates stored in app data

Projects only control which templates are enabled for that project.

### 7.8 Plugins

PW Studio is now plugin-first.

Core provides generic extension points for:

- recorder transforms
- block definitions
- block templates
- project setup hooks
- routes
- UI metadata

Plugins are discovered from:

- `~/.pw-studio/plugins`
- optional configured extra directories
- `pw-studio/plugins` for shipped local plugins

Project enablement is stored in:

```text
.pw-studio/plugins/<plugin-id>.json
```

### 7.9 Integrations

The UI exposes:

- global plugin manager
- project integrations page
- global block library page

These pages let users inspect installed plugins, enable them per project, and manage reusable block templates.

## 8. Plugin Contract

### 8.1 Manifest

Each plugin has a manifest with:

- `id`
- `name`
- `version`
- `description`
- `capabilities`
- optional backend/frontend metadata

### 8.2 Runtime Contributions

Plugins may register:

- recorder transforms
- block definitions and templates
- project setup hooks
- routes
- event listeners

### 8.3 Project Setup

When enabled for a project, plugins may scaffold project-local files. Core only orchestrates the hook; the plugin defines what it needs.

## 9. Shipped Plugin Example

The repo currently ships `mendix-portable-workflow` as an optional plugin.

It adds:

- a recorder normaliser for brittle Mendix cell clicks
- helper scaffolding in `tests/support/mendix-pointers.ts`
- a project-local Mendix map file
- a Mendix-specific visual block for `mx.clickRowCell(...)`

This plugin exists to validate the generic runtime. It is not a special case in core.

## 10. API Surface

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
- `/api/block-library`
- `/api/plugins`
- `/api/projects/:id/plugins`
- `/api/openapi.json`
- `/api/plugins/:pluginName/*`

## 11. Backend Architecture

The server is organised as:

1. routes
2. services
3. database and migrations
4. plugin runtime and loader
5. websocket and static hosting infrastructure

### 11.1 Service Container

`ServiceContainer` wires together:

- `db`
- `broadcast`
- `events`
- domain services
- `pluginRuntime`
- block library service
- test editor service

### 11.2 Plugin Runtime

The plugin runtime owns:

- block definition registry
- block template registry
- recorder transform pipeline
- project setup handlers
- loaded plugin metadata

Core block definitions and recorder refinement are registered through the same runtime path as external plugins.

## 12. Database and Files

SQLite remains the system of record for projects, runs, test results, settings, and artefact policy.

File-backed config is used for:

- visual editor cache
- custom block templates
- project block-library availability
- per-project plugin enablement
- plugin-specific project files

## 13. Filesystem and Process Rules

- Use `path.join()` and `path.resolve()`
- Resolve `testDir` from project config rather than hardcoding test locations
- spawn the local Playwright binary only
- cancel process trees correctly on Windows
- open artefacts through OS shell commands

## 14. Project Structure

```text
pw-studio/
|-- plugins/                  # shipped local plugins
|-- src/
|   |-- server/
|   |   |-- db/
|   |   |-- middleware/
|   |   |-- plugins/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- utils/
|   |   |-- index.ts
|   |   `-- ws.ts
|   |-- renderer/
|   |   |-- public/
|   |   `-- src/
|   |       |-- api/
|   |       |-- components/
|   |       `-- pages/
|   `-- shared/
|       `-- types/
|-- sample-project/
|-- vite.config.ts
|-- tsconfig.server.json
|-- tsconfig.web.json
`-- package.json
```

## 15. Runtime Start-Up

1. resolve runtime paths and open SQLite
2. create shared event emitter
3. create WebSocket server and broadcaster
4. create services
5. register core plugin contributions
6. load external and shipped plugins
7. register API routes and OpenAPI
8. serve SPA assets or rely on the Vite frontend in development

## 16. Build Phases

### Phase 1 - Foundation (Complete)

Express server, React SPA, route constants, envelope transport, settings bootstrap, project registry.

### Phase 2 - Project Lifecycle + Health (Complete)

Project creation/import, template generation, config reading, health checks.

### Phase 3 - Explorer (Complete)

Indexing, file tree, test case detection, file reading and writing.

### Phase 4 - Run Engine (Complete)

Run orchestration, command building, log streaming, result persistence.

### Phase 5 - Artefacts (Complete)

Artefact policies, rerun failed, report and trace access.

### Phase 6 - Environments + Secrets + Recorder (Complete)

Environments, keychain-backed secrets, recorder and save flow.

### Phase 7 - Packaging + Platform (Complete)

Bundled runtime, OpenAPI, block library, visual editor, plugin runtime, plugin management, documentation.

### Phase 8 - UX + Design Overhaul (In Progress)

Dashboard redesign, block editor enhancements (subflows, parameters, constants), suites page, continuous recording, report button, Carbon Logic design system, dark mode support, UX polish on explorer and runs pages.

## 17. UX + Design

The application now implements a Carbon Logic design system with:

- Fixed header with app title and global controls
- Compact left rail for navigation and project selection
- Central workspace panel for content
- Dark mode support with mode-aware CSS variables
- Dense panel and table primitives for efficient screen usage
- Consistent icon system via the `UiIcon` component
- Responsive error banners and empty states aligned with API errors
- Redesigned dashboard with improved summary statistics
- Improved runs page layout and result presentation

## 18. Technical Debt

- Frontend plugin code loading is not yet dynamic; plugins currently expose backend/runtime capabilities and UI metadata
- Plugins run in-process with lightweight isolation
- Visual editor block coverage is still intentionally partial, with raw code fallback for unsupported statements
- End-to-end automated browser coverage should be expanded for plugin flows and recorder-to-block pipelines
- Subflow invocation currently uses inline comment markers; a more robust metadata system may be needed
- Continuous recording pause/resume is tied to the Playwright binary output; more granular control may be beneficial
