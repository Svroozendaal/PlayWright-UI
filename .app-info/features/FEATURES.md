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
| Report button | complete | Direct access to HTML report from run detail |
| Suites | complete | Batch test execution with grouped, configured test suites |
| Continuous recording | complete | Pause/resume recording functionality during test runs |

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
| Constants and block parameters | complete | Top-level const declarations and parameter mapping to blocks |
| Subflows | complete | Test-to-test invocation and reusable block flows |
| Block input/output mapping | complete | Flow parameter definitions and variable binding |

## Packaging + Platform

| Feature | Status | Notes |
|---|---|---|
| `npm` install/start flow | complete | Standard local runtime path |
| Bundled runtime | complete | Zipped Node runtime packaging |
| PWA manifest | complete | Installable browser app metadata |
| Documentation set | complete | Blueprint, product docs, public docs, and skill registry updated |

## UX + Design

| Feature | Status | Notes |
|---|---|---|
| Carbon Logic styling system | complete | Fixed header, compact rail, central workspace, dense primitives |
| Dark mode token support | complete | Mode-aware CSS variables and panel/table styling |
| Dashboard redesign | complete | Updated layout and summary statistics |
| Runs page redesign | complete | Improved layout and result presentation |
| UiIcon component | complete | Consistent icon system across the UI |
