# PW Studio — Architecture

## Overview

PW Studio is structured in four layers around a local web runtime:

```text
┌───────────────────────────────┐
│          Browser UI           │  React + TypeScript
│   Pages, Components, Hooks    │  BrowserRouter, no Node access
├───────────────────────────────┤
│        API Client Layer       │  fetch + WebSocket
│   ApiEnvelope + useSocket     │  shared route and event constants
├───────────────────────────────┤
│      Local Server Layer       │  Express + TypeScript
│   Routes, Services, Plugins   │  all business logic here
├───────────────────────────────┤
│       System / OS Layer       │  SQLite, keytar, chokidar
│   File system, child_process  │  Playwright binary spawn
└───────────────────────────────┘
```

## Layer Responsibilities

### Browser UI

- Displays the UI and handles user interaction.
- Talks to the backend via the fetch client and shared WebSocket hook.
- Has no direct access to Node.js, filesystem, or database APIs.

### API Client Layer

- Wraps HTTP calls in `ApiEnvelope<T>`.
- Maintains a singleton WebSocket connection.
- Maps server push events into React subscriptions.

### Local Server Layer

- `ServiceContainer`: dependency injection for long-lived services and runtime helpers.
- `routes/`: one route module per domain.
- `services/`: project registry, health, file watching, indexing, runs, artifacts, settings, secrets, environments, recorder, dashboard.
- `plugins/`: optional in-process extensions.
- `openapi.ts`: generated API contract.

### System Layer

- **SQLite (`better-sqlite3`)**: persists projects, runs, results, artifact policies, and settings.
- **`keytar`**: OS keychain for secrets, no plaintext fallback.
- **chokidar**: file watching with debounce for index and cache invalidation.
- **`child_process`**: spawns Playwright for test runs and codegen.

## Transport Model

- HTTP endpoints live under `/api`
- Push events use `/ws`
- All route responses use `ApiEnvelope<T>`
- Shared constants define routes, events, and error codes

## Database

The database lives in the local app-data directory:

- Windows: `%APPDATA%/pw-studio/pw-studio.db`
- macOS: `~/Library/Application Support/pw-studio/pw-studio.db`
- Linux: `~/.config/pw-studio/pw-studio.db`

Migrations are append-only and run at server start before the app begins serving requests.

## Full Specification

See `.app-info/docs/PW_STUDIO_BLUEPRINT.md` for the complete architecture blueprint, including routes, event flow, database rules, plugin boundaries, and build phases.
