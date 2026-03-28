Migration Plan: PW Studio — Electron to Web-Based Architecture
Context
PW Studio is currently an Electron desktop app wrapping Playwright Test with a GUI. The user wants to migrate to a lightweight web-based architecture (local Node.js HTTP server + browser UI) to eliminate the ~100MB Electron overhead, simplify the build pipeline, enable AI/MCP accessibility via REST API, and support a plugin system. All functional capabilities (code editor, file read/write, test execution, etc.) are preserved.

The user's explicit priority: update all documentation first (blueprint, features, config, etc.) to establish the new narrative before modifying code.

Step 0 — Documentation & Narrative Updates
Update every document that references Electron, IPC, preload, contextBridge, electron-builder, or BrowserWindow to reflect the new web-based architecture.

0A. Blueprint Rewrite
File: .app-info/docs/PW_STUDIO_BLUEPRINT.md

Changes:

Section 1 (Productdoel): "Electron desktop-app" → "local web application (Node.js server + browser UI)"
Section 3 (Stack): Replace table — Electron → Express/Fastify, electron-builder → npm package / standalone binary
Section 4 (IPC Architecture): Full rewrite — replace ipcMain/ipcRenderer/contextBridge with:
REST API (Express routes) for request/response
WebSocket (ws) for push events (replaces webContents.send)
New API client module replacing window.api
Keep the IpcEnvelope pattern as the standard response wrapper
Section 14 (Project structure): Remove src/preload/, add src/server/ with routes/middleware
Section 16 (Build Phases): Rewrite all phases to remove Electron references
Section 17 (Technical Debt): Remove electron-specific items, add web-specific ones
0B. App Overview
File: .app-info/app/OVERVIEW.md

Line 9: "local Electron desktop app" → "local web application"
Non-Goals: Remove "Not cross-platform in v1 (Windows only)" — web works everywhere
Add non-goal: "Not a cloud-hosted service — runs locally on the developer's machine"
0C. Product Plan
File: .app-info/app/PRODUCT_PLAN.md

Phase 1: "Electron shell, React renderer, preload/contextBridge" → "Express server, React SPA, REST API + WebSocket"
Phase 7: "Windows .exe (electron-builder)" → "npm package, standalone binary (pkg), PWA manifest"
Definition of Done item 11: ".exe" → "install via npm or standalone binary"
0D. Config/Stack
File: .app-info/config/OVERVIEW.md

Stack table: Electron → Express/Fastify, electron-builder → pkg/npm
Project structure: Remove preload/, add server/ with routes
Remove postinstall electron-rebuild reference
0E. Features Registry
File: .app-info/features/FEATURES.md

Phase 1: "Electron shell + React renderer" → "Express server + React SPA"
Phase 1: "Preload / contextBridge / IPC envelope" → "REST API + WebSocket + API client"
Phase 1: "IPC channel constants" → "API route constants"
Phase 7: "Windows .exe (electron-builder)" → "npm package + standalone binary"
Add new features: "Plugin system", "REST API for AI/MCP integration"
0F. Skills Overview
File: .app-info/skills/OVERVIEW.md

Replace "Electron + React Scaffold" → "Express + React Scaffold"
Replace "Electron IPC" → "REST API + WebSocket"
Replace "Electron Builder Packaging" → "npm/pkg Packaging"
Keep unchanged: SQLite, Playwright Binary, chokidar, child-process-spawn, etc.
0G. CLAUDE.md (root)
File: CLAUDE.md

Line 25: "Local Electron desktop app" → "Local web application"
Stack line: "Electron |" → "Express |"
Remove electron-specific conventions, add: "Use npm run dev to start server + Vite dev"
0H. Development Overview
File: .app-info/development/OVERVIEW.md

Remove "Preload script in src/preload/"
"Main process code in src/main/" → "Server code in src/server/"
"IPC uses the envelope pattern" → "API uses the envelope pattern over HTTP + WebSocket"
0I. Phase Prompts (8 files + 1 feature prompt)
All files in .app-info/development/prompts/:

PHASE_1_FOUNDATION.md — Major rewrite:

Remove all electron-vite, preload, contextBridge references
Scaffold with Vite (frontend) + Express/Fastify (backend) + concurrently
Replace IPC handler registration with Express route registration
Replace BrowserWindow security with CORS + localhost-only binding
Replace dialog handlers with directory-listing API endpoint
Skills: electron-react-scaffold → express-react-scaffold, electron-ipc → rest-websocket-api
PHASE_2_PROJECT_LIFECYCLE.md through PHASE_8_UX_OVERHAUL.md:

Replace all ipcMain.handle() references with Express route handlers
Replace all webContents.send() with WebSocket broadcasts
Replace window.api.invoke() with api.invoke() (thin fetch wrapper)
Replace window.api.on()/off() with WebSocket subscription hooks
Replace skill references from electron-ipc to rest-websocket-api
PHASE_7: Replace entire electron-builder section with npm/pkg packaging
FEATURE_IMPROVE_CODEGEN.md — Update IPC references if present

0J. Skill Files (3 to replace, 10 to update)
Delete or rewrite:

.app-info/skills/electron-react-scaffold/SKILL.md → rewrite as express-react-scaffold/SKILL.md
.app-info/skills/electron-ipc/SKILL.md → rewrite as rest-websocket-api/SKILL.md
.app-info/skills/electron-builder-packaging/SKILL.md → rewrite as web-packaging/SKILL.md
Minor updates (remove Electron rebuild references):

.app-info/skills/sqlite-migrations/SKILL.md — remove electron-rebuild, native module stays but simpler
.app-info/skills/keytar-secrets/SKILL.md — remove electron-rebuild reference
0K. Memory Files
Files in .app-info/memory/: Clear or update SESSION_STATE.md, DECISIONS_LOG.md, PROGRESS.md to reflect the architecture pivot decision.

Step 1 — Create Server Infrastructure (Backend)
Replace Electron main process with an Express HTTP server + WebSocket.

1A. New Server Entry Point
New file: src/server/index.ts (replaces src/main/index.ts)

- Create Express app
- Bind to localhost:0 (random port) or configurable PORT
- Serve static files (built React SPA) from dist/client/
- Attach WebSocket server (ws library) on /ws
- Open SQLite database (path: platform-specific user data dir)
- Create ServiceContainer (db, wsBroadcast function instead of BrowserWindow)
- Register all route handlers
- Graceful shutdown (SIGINT/SIGTERM → unwatchAll, closeDatabase, server.close)
- Print URL to stdout on startup
1B. Replace BrowserWindow with WebSocket Broadcaster
Modify: src/server/services/ServiceContainer.ts (moved from src/main/)

Remove BrowserWindow import and win property
Add broadcast: (channel: string, data: unknown) => void function
Services that used win.webContents.send() now call broadcast()
Affects: FileWatchService, RunService, RecorderService
1C. WebSocket Server
New file: src/server/ws.ts

- Create WebSocket server attached to HTTP server
- Track connected clients
- broadcast(channel, data) → sends JSON { channel, data } to all clients
- Handle client connect/disconnect
1D. Database Path Without Electron
Modify: src/server/db/database.ts (moved from src/main/db/)

Replace app.getPath('userData') with platform-specific path:
Windows: %APPDATA%/pw-studio/
macOS: ~/Library/Application Support/pw-studio/
Linux: ~/.config/pw-studio/
Use os.homedir() + process.env.APPDATA or process.platform detection
1E. Settings Without Electron
Modify: src/server/services/SettingsService.ts

Replace app.getPath('documents') with os.homedir() + '/Documents' or path.join(os.homedir(), 'Documents')
1F. Artifacts Without Electron Shell
Modify: src/server/services/ArtifactService.ts

Replace shell.openPath() with child_process.exec():
Windows: start "" "filepath"
macOS: open "filepath"
Linux: xdg-open "filepath"
Step 2 — Convert IPC Handlers to REST Routes
Mechanical conversion: each ipcMain.handle(IPC.CHANNEL, handler) becomes an Express route.

2A. Route Registration Pattern
New file: src/server/routes/index.ts

export function registerAllRoutes(app: Express, services: ServiceContainer): void {
  registerProjectRoutes(app, services)
  registerHealthRoutes(app, services)
  registerExplorerRoutes(app, services)
  // ... etc for all 14 handler files
}
2B. IPC → REST Mapping (all 14 handler files)
Each handler file in src/main/ipc/ becomes a route file in src/server/routes/:

Old File	New File	Method + Path
projectHandlers.ts	projects.ts	GET /api/projects, POST /api/projects, POST /api/projects/import, GET /api/projects/:id, POST /api/projects/:id/open, DELETE /api/projects/:id, PATCH /api/projects/:id/settings
dialogHandlers.ts	directories.ts	POST /api/directories/browse (returns dir listing for in-app folder browser)
healthHandlers.ts	health.ts	GET /api/projects/:id/health, POST /api/projects/:id/health/refresh, GET /api/projects/:id/config
explorerHandlers.ts	explorer.ts	GET /api/projects/:id/explorer/tree, POST /api/projects/:id/explorer/refresh, GET /api/projects/:id/explorer/file-policy, PUT /api/projects/:id/explorer/file-policy, GET /api/projects/:id/explorer/last-results
runHandlers.ts	runs.ts	POST /api/projects/:id/runs, GET /api/projects/:id/runs, GET /api/runs/:runId, DELETE /api/runs/:runId (cancel), POST /api/runs/:runId/rerun, GET /api/runs/:runId/results
artifactHandlers.ts	artifacts.ts	GET /api/runs/:runId/artifacts, POST /api/artifacts/open, POST /api/artifacts/open-report, POST /api/artifacts/show-trace, POST /api/runs/:runId/rerun-failed
environmentHandlers.ts	environments.ts	GET /api/projects/:id/environments, POST /api/projects/:id/environments, PUT /api/environments/:envId, DELETE /api/environments/:envId
secretHandlers.ts	secrets.ts	POST /api/secrets, GET /api/secrets/masked, DELETE /api/secrets
recorderHandlers.ts	recorder.ts	POST /api/projects/:id/recorder/start, POST /api/recorder/stop, GET /api/recorder/status, POST /api/recorder/save
fileHandlers.ts	files.ts	POST /api/files/read, POST /api/files/write, POST /api/files/create
flakyHandlers.ts	flaky.ts	GET /api/projects/:id/flaky, GET /api/projects/:id/flaky/:testTitle/history
comparisonHandlers.ts	comparison.ts	GET /api/runs/compare?a=X&b=Y
dashboardHandlers.ts	dashboard.ts	GET /api/projects/:id/dashboard
settingsHandlers.ts	settings.ts	GET /api/settings/app-info, GET /api/settings/:key, PUT /api/settings/:key
2C. Envelope Middleware
New file: src/server/middleware/envelope.ts

Wrap all route responses in IpcEnvelope<T> format automatically, and catch errors into { version: 1, error: { code, message } }.

2D. Dialog Replacement — Directory Browser API
Replace dialog.showOpenDialog() with a server-side directory listing endpoint:

POST /api/directories/browse — accepts { path: string }, returns { entries: [{ name, type, path }] }
Frontend builds an in-app folder picker component using this API
Start path defaults to user's home directory or Documents
2E. Update Shared Types
Modify: src/shared/types/ipc.ts

Keep all domain types (RegisteredProject, RunRecord, ExplorerNode, etc.)
Replace IPC channel constants with API_ROUTES path constants
Keep IpcEnvelope<T> as the response wrapper (rename to ApiEnvelope<T> optionally)
Keep ERROR_CODES
Step 3 — Migrate Frontend
3A. API Client Module
New file: src/renderer/src/api/client.ts

const BASE = '' // same-origin when served by the server

export const api = {
  async invoke<T>(path: string, payload?: unknown): Promise<ApiEnvelope<T>> {
    const res = await fetch(`${BASE}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    })
    return res.json()
  },
  // GET helper
  async get<T>(path: string): Promise<ApiEnvelope<T>> { ... },
}
3B. WebSocket Hook
New file: src/renderer/src/api/useSocket.ts

// Singleton WebSocket connection
// useSocketEvent(channel, handler) — subscribes on mount, unsubscribes on unmount
// Replaces window.api.on() / window.api.off() pattern exactly
3C. Update All Pages (11 files)
For each page in src/renderer/src/pages/:

Replace window.api.invoke(IPC.X, payload) → api.get('/path') or api.invoke('/path', payload)
Replace window.api.on(IPC.X, handler) → useSocketEvent('channel', handler)
Replace window.api.off(IPC.X, handler) → automatic via hook cleanup
Pages to update:

ProjectsPage.tsx — 3 invokes + dialog replacement (use new folder picker component)
DashboardPage.tsx — 2 invokes + 1 listener
ExplorerPage.tsx — 8 invokes + 2 listeners
RunsPage.tsx — 1 invoke + 1 listener
RunDetailPage.tsx — 8 invokes + 2 listeners
RunComparisonPage.tsx — 1 invoke
EnvironmentsPage.tsx — 4 invokes + 1 listener
RecorderPage.tsx — 6 invokes + 1 listener (dialog replacement needed)
FlakyTestsPage.tsx — 2 invokes
SettingsPage.tsx — 4 invokes
ProjectDetailPage.tsx — 2 invokes
3D. Update All Components (8 files)
ProjectLayout.tsx — 4 invokes + 1 listener
CreateProjectWizard.tsx — 2 invokes (dialog → folder picker component)
HealthPanel.tsx — 2 invokes
RunDialog.tsx — 4 invokes (dialog replacement for save file)
ArtifactPolicyEditor.tsx — 2 invokes
Sidebar.tsx — no IPC (unchanged)
ErrorBanner.tsx — no IPC (unchanged)
CodeEditor.tsx — no IPC (unchanged)
3E. New Component: Folder Picker
New file: src/renderer/src/components/FolderPicker.tsx

Replaces dialog.showOpenDirectory()
Calls POST /api/directories/browse to list directories
Breadcrumb navigation, click-to-enter, select button
Used by CreateProjectWizard and RecorderPage
3F. Router Change
Modify: src/renderer/src/App.tsx

HashRouter → BrowserRouter (server handles client-side routing via catch-all)
3G. Remove Preload Types
Delete: src/preload/index.d.ts Modify: src/renderer/src/env.d.ts — remove Window.api declaration

Step 4 — Build System Overhaul
4A. New Build Config
Delete: electron.vite.config.ts, electron-builder.yml

New file: vite.config.ts (renderer only)

- React plugin
- Build output: dist/client/
- Dev server with proxy to backend (localhost:PORT)
New file: tsconfig.server.json (replaces tsconfig.node.json)

- Compiles src/server/ + src/shared/
- Target: ES2022, module: NodeNext
- No DOM types
Modify: tsconfig.web.json

Remove Electron-specific paths
4B. New package.json Scripts
{
  "scripts": {
    "dev": "concurrently \"vite\" \"tsx watch src/server/index.ts\"",
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "typecheck": "tsc --noEmit -p tsconfig.server.json && tsc --noEmit -p tsconfig.web.json"
  }
}
4C. Dependency Changes
Remove:

electron, electron-vite, electron-builder, @electron-toolkit/utils, @electron/rebuild
Add:

express (or fastify), ws, cors, concurrently, tsx (dev), @types/express, @types/ws
Keep:

better-sqlite3 (no more electron-rebuild needed!), keytar, chokidar
react, react-dom, react-router-dom, vite, @vitejs/plugin-react, typescript
4D. Remove Electron Files
src/main/index.ts → replaced by src/server/index.ts
src/preload/index.ts + src/preload/index.d.ts → deleted
electron-builder.yml → deleted
electron.vite.config.ts → deleted
scripts/run-electron-vite.cjs → deleted
Step 5 — New Capabilities
5A. Plugin System
New file: src/server/plugins/loader.ts

interface PwStudioPlugin {
  name: string
  version: string
  activate(ctx: PluginContext): void | Promise<void>
  deactivate?(): void
  routes?(router: Router): void
  onEvent?(channel: string, data: unknown): void
}

interface PluginContext {
  api: ServiceContainer  // typed access to all services
  events: EventEmitter   // subscribe to internal events
  logger: Logger
}
Plugins discovered from ~/.pw-studio/plugins/ or a plugins config file
Each plugin can register Express sub-routes under /api/plugins/:pluginName/
Plugins receive events via EventEmitter (same events as WebSocket channels)
5B. AI / MCP Accessibility
The REST API is already the MCP interface. To formalise:

New file: src/server/openapi.ts

Auto-generate OpenAPI spec from registered routes
Serve at GET /api/openapi.json
Each route's types map directly to MCP tool schemas
5C. PWA Manifest
New file: src/renderer/public/manifest.json

App name, icons, theme colour, display: standalone
Allows "Install as app" from Chrome for native-like experience
Step 6 — Directory Restructure
Final Structure
pw-studio/
  src/
    server/                    (was src/main/)
      index.ts                 (Express server entry)
      ws.ts                    (WebSocket server)
      routes/                  (was src/main/ipc/)
        index.ts
        projects.ts
        health.ts
        explorer.ts
        runs.ts
        artifacts.ts
        environments.ts
        secrets.ts
        recorder.ts
        files.ts
        flaky.ts
        comparison.ts
        dashboard.ts
        settings.ts
        directories.ts         (replaces dialogHandlers)
      services/                (moved from src/main/services/)
        ServiceContainer.ts    (no BrowserWindow, has broadcast fn)
        ... all 16 services (minimal changes)
      db/                      (moved from src/main/db/)
        database.ts            (no Electron app import)
        migrations.ts
      utils/                   (moved from src/main/utils/)
        playwrightBinary.ts
        playwrightConfigReader.ts
      middleware/
        envelope.ts            (error wrapping)
      plugins/
        loader.ts
    renderer/                  (mostly unchanged)
      src/
        api/
          client.ts            (replaces window.api)
          useSocket.ts         (WebSocket hook)
        components/
          FolderPicker.tsx     (new — replaces native dialogs)
          ... existing components
        pages/
          ... existing pages (updated imports)
    shared/                    (mostly unchanged)
      types/
        ipc.ts                 (renamed constants, keep domain types)
  vite.config.ts               (replaces electron.vite.config.ts)
  tsconfig.server.json         (replaces tsconfig.node.json)
  tsconfig.web.json            (updated)
  package.json                 (updated deps + scripts)
Step 7 — Verification
How to Test End-to-End
npm run dev → server starts on localhost, Vite dev server proxies to it
Open browser → Projects page loads, can create/import project
Import a real Playwright project → health checks pass
Explorer shows file tree, updates on external file changes (WebSocket push)
Click a test file → CodeEditor loads content with syntax highlighting
Edit + Ctrl+S → file saves via REST API
Run a test → logs stream in real-time via WebSocket
Recorder page → starts codegen, status updates via WebSocket
Settings page → shows app info (version, db path)
npm run build && npm start → production build serves SPA + API from single server
REST API accessible: curl http://localhost:PORT/api/projects returns JSON envelope
Implementation Order
Order	Step	Scope	Files Changed
1	0A-0K	Docs rewrite	~20 .md files
2	1A-1F	Server infra	5 new/modified server files
3	2A-2E	IPC → REST	14 route files + shared types
4	3A-3G	Frontend migration	19 React files + 3 new files
5	4A-4D	Build system	package.json, vite.config, tsconfigs, delete Electron files
6	5A-5C	New capabilities	3 new files (plugin loader, openapi, PWA manifest)
7	6	Restructure	Move files from src/main → src/server
8	7	Verification	Manual + automated testing
Note: Steps 2-4 can be done as a single atomic refactor (move files, convert handlers, update frontend) since the app won't work in a half-migrated state. Steps 1 and 5 are independent bookends.

Add Comment