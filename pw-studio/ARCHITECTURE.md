# PW Studio - Architecture

## Overview

PW Studio is a local-first Playwright orchestration platform with a plugin-first backend. The browser UI is a client of the local server, not a privileged runtime.

```text
Browser UI -> API client + WebSocket -> Local server -> Filesystem / SQLite / Playwright / OS keychain
```

## Core Layers

### Renderer

- React SPA with `BrowserRouter`
- Uses `api.invoke(...)` compatibility calls over HTTP
- Uses a shared WebSocket hook for push events
- Contains the code editor, visual block editor, recorder pages, run views, and plugin management views

### Shared Contract Layer

- `src/shared/types/ipc.ts`
- Defines `ApiEnvelope<T>`, route constants, event constants, plugin summaries, block definitions, and domain models
- Keeps the temporary `IPC` compatibility map for frontend calls

### Server

- Express server with route registry, envelope middleware, and OpenAPI generation
- Service container for long-lived business services
- WebSocket broadcaster plus internal `EventEmitter`
- Plugin runtime and loader

### Runtime Integrations

- SQLite for projects, runs, results, settings, and artefact policy
- `keytar` for secrets
- `chokidar` for filesystem watching
- local Playwright binary for runs and codegen

## Plugin-First Runtime

Core PW Studio now exposes extension points instead of hardcoding system-specific behaviour.

Runtime services can register:

- block definitions
- block templates
- recorder transforms
- project setup hooks
- routes
- UI metadata

Built-in visual blocks go through the same registry path as external plugins. This keeps the core generic and lets plugins add new authoring primitives without changing the core editor contracts.

### Plugin Discovery

Plugins are discovered from:

- `~/.pw-studio/plugins`
- optional configured extra directories
- `pw-studio/plugins` inside this repo for shipped local plugins

### Project Enablement

Plugin installation is app-wide. Enablement is project-specific and stored in:

```text
.pw-studio/plugins/<plugin-id>.json
```

Plugins can scaffold additional project files when enabled.

## Visual Test Authoring

The visual editor is an authoring layer only. The `.spec.ts` file remains the only persisted and executable source of truth.

The editor supports:

- loading an existing `test(...)` into canonical blocks
- editing supported statements through typed blocks
- keeping unsupported code as raw code blocks
- saving back into the selected test in the source file
- appending a new test to an existing test file

Block state is also cached locally for faster reloads, but execution always uses the saved code file.

## Block Library

The block library page is global and file-backed. It combines:

- core built-in block templates
- plugin-contributed block templates
- custom templates stored in app data

Projects only control which templates are enabled for that project.

## Mendix Plugin

The shipped Mendix plugin currently adds:

- a recorder normaliser for brittle Mendix cell clicks
- helper scaffolding in `tests/support/mendix-pointers.ts`
- a project map file for container hints
- a Mendix-specific visual block for `mx.clickRowCell(...)`

This is the first plugin on top of the generic runtime, not a special case in core.

## Security Model

- Bind HTTP and WebSocket to `127.0.0.1`
- Keep file, process, and secret access on the server
- Validate request bodies and route params at the boundary
- Use the OS keychain through `keytar`

## Main Documents

- Blueprint: `../.app-info/docs/PW_STUDIO_BLUEPRINT.md`
- Product overview: `../.app-info/app/OVERVIEW.md`
- Feature registry: `../.app-info/features/FEATURES.md`
