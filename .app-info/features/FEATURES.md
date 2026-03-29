# FEATURE REGISTRY - PW Studio

## Foundation

| Feature | Status | Notes |
|---|---|---|
| Express server + React SPA | complete | Local browser UI hosted by the Node server |
| SQLite + migrations | complete | Core project, run, artefact, and settings persistence |
| REST API + WebSocket transport | complete | Shared envelope and event contracts |
| OpenAPI generation | complete | Exposed at `/api/openapi.json` |

## Projects + Health

| Feature | Status | Notes |
|---|---|---|
| Project creation wizard | complete | Includes native directory chooser |
| Existing project import | complete | Supports real Playwright projects |
| Playwright config summary | complete | Surfaces `testDir`, projects, and output directory |
| Health checks | complete | Cached health model with project-level refresh |

## Explorer + Editing

| Feature | Status | Notes |
|---|---|---|
| File tree and watcher refresh | complete | Uses `chokidar` and project indexing |
| File reading and saving | complete | Browser code editor writes back to project files |
| Test-case discovery | complete | Stable `TestCaseRef` for selected tests |
| Visual block editor | complete | Authoring layer that writes normal Playwright code back to the file |
| Visual document cache | complete | Cached locally, but execution still uses saved code |

## Runs + Artefacts

| Feature | Status | Notes |
|---|---|---|
| Run orchestration | complete | File, folder, and test-case execution |
| Headed mode and options | complete | Existing run pipeline preserved |
| Log streaming | complete | WebSocket push events |
| Run history and detail | complete | Results, reports, traces, and reruns |
| Artefact policy management | complete | Project and file-level behaviour |
| Run comparison | complete | Compare result sets between runs |

## Environments + Secrets + Recorder

| Feature | Status | Notes |
|---|---|---|
| Environment management | complete | Project-level environments with overrides |
| Keychain-backed secrets | complete | `keytar` only |
| Recorder start/stop/save | complete | Native directory chooser and save path flow |
| Recorder code refinement | complete | Generic recorder transform pipeline |
| Post-recording suggestions | complete | Suggestions and extracted values surfaced in the UI |

## Block Library + Plugins

| Feature | Status | Notes |
|---|---|---|
| Global block library | complete | File-backed custom template management |
| Project template enablement | complete | Per-project availability filtering |
| Plugin runtime | complete | Generic registries for blocks, transforms, and setup hooks |
| Plugin manager | complete | Global installed-plugin view |
| Project integrations page | complete | Per-project plugin enablement |
| Mendix Portable Workflow plugin | complete | Optional shipped plugin for recorder and block extensions |

## Packaging + Platform

| Feature | Status | Notes |
|---|---|---|
| `npm` install/start flow | complete | Standard local runtime path |
| Bundled runtime | complete | Zipped Node runtime packaging |
| PWA manifest | complete | Installable browser app metadata |
| Documentation set | complete | Blueprint, product docs, public docs, and skill registry updated |
