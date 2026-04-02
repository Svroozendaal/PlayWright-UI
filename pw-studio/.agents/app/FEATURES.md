# FEATURES — PW Studio

## Foundation

| Feature | Status |
|---|---|
| Express server + React SPA | complete |
| SQLite + migrations | complete |
| REST API + WebSocket transport | complete |
| OpenAPI generation at `/api/openapi.json` | complete |

## Projects and Health

| Feature | Status |
|---|---|
| Project creation wizard (with native directory chooser) | complete |
| Existing project import | complete |
| Playwright config summary (`testDir`, projects, output dir) | complete |
| Health checks with project-level refresh | complete |

## Explorer and Editing

| Feature | Status |
|---|---|
| File tree with `chokidar` watcher refresh | complete |
| File read and save via browser code editor | complete |
| Test-case discovery with stable `TestCaseRef` | complete |
| Visual block editor (authoring layer, writes normal Playwright code) | complete |
| Visual document cache (local, not runtime) | complete |

## Runs and Artefacts

| Feature | Status |
|---|---|
| Run orchestration (file, folder, and test-case) | complete |
| Headed mode and run options | complete |
| Realtime log streaming via WebSocket | complete |
| Run history, test results, artefact paths | complete |
| Artefact policy management (project and file-level) | complete |
| Run comparison (side-by-side result sets) | complete |
| Direct HTML report access from run detail | complete |
| Suites (batch test execution, grouped and configured) | complete |
| Continuous recording (pause/resume during runs) | complete |

## Environments, Secrets, and Recorder

| Feature | Status |
|---|---|
| Per-project environment management with variable overrides | complete |
| Keychain-backed secrets via `keytar` | complete |
| Recorder start, stop, and save (with native path chooser) | complete |
| Recorder code refinement transform pipeline | complete |
| Post-recording suggestions and extracted values | complete |

## Block Library and Plugins

| Feature | Status |
|---|---|
| Global file-backed block library (core + plugin + custom) | complete |
| Per-project template enablement filtering | complete |
| Constants block (leading const declarations with syntax validation) | complete |
| Block parameters (configurable input fields) | complete |
| Subflows (test-to-test invocation with parameter passing) | complete |
| Flow input definitions and mapping | complete |
| Plugin manager UI (global) | complete |
| Project integrations page (per-project plugin control) | complete |
| Plugin discovery from user global and local shipped directories | complete |
