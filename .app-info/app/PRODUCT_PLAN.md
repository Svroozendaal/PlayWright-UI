# PRODUCT PLAN - PW Studio

## Delivered Platform Shape

PW Studio v1 now consists of:

- local Express server
- React SPA
- REST API + WebSocket transport
- SQLite persistence
- plugin-first backend runtime
- visual block authoring that saves back into Playwright code

## Delivery Phases

### Phase 1 - Foundation

Express server, React SPA, route contracts, project registry, settings bootstrap, local browser runtime.

### Phase 2 - Project Lifecycle + Health

Project creation and import, Playwright config extraction, health checks, project defaults.

### Phase 3 - Explorer

Project indexing, file tree, test-case discovery, file IO, code editor.

### Phase 4 - Run Engine

Run orchestration, headed mode, command building, realtime logs, persisted results and reports.

### Phase 5 - Artefacts

Artefact policy storage, rerun failed, trace/report opening, comparison support.

### Phase 6 - Environments + Secrets + Recorder

Environment management, keychain-backed secrets, recorder start/stop/save, recorder refinement.

### Phase 7 - Packaging + Platform

Bundled runtime, OpenAPI, block library, visual editor, plugin runtime, plugin management, documentation.

## Definition of Done

PW Studio v1 is complete when a user can:

1. Create or import a Playwright project
2. Validate the project health
3. Browse, edit, and save Playwright files
4. Run tests and inspect logs, statuses, and artefacts
5. Record codegen and save the output into the project
6. Open a test case in a visual block editor and save back to code
7. Manage a reusable block library
8. Enable optional plugins per project
9. Install via `npm` or the bundled local runtime

## Current Shipped Extension

The repo includes a shipped optional Mendix plugin to validate the plugin runtime and block-extension model.
