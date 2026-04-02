# APP OVERVIEW — PW Studio

## Name

PW Studio

## One-Line Description

A local web application for Playwright Test orchestration — project management, health checks, file editing, test execution, artefact access, recorder flows, visual block authoring, and a plugin-first extension model.

## Core Principles

1. **Registry, not relocation** — project folders stay where they already live; only metadata is stored in PW Studio.
2. **Local binary execution** — always use the local Playwright binary, never `npx playwright`.
3. **File as source of truth** — `.spec.ts` files are the only executable and persisted test format.
4. **Graceful degradation** — unsupported visual-editor statements remain editable as raw code blocks.
5. **Plugin-first extension** — system-specific behaviour belongs in plugins, not in core.
6. **Local-only runtime** — no cloud, multi-user, or remote execution model in v1.
7. **OS keychain only** — no plaintext secret storage.

## Main User Areas

| Area | Description |
|---|---|
| Projects | Create, import, and manage Playwright projects |
| Dashboard | Summary view with key metrics and recent activity |
| Explorer | File tree with code editor and visual block editor |
| Runs | Execution history, logs, results, and artefacts |
| Suites | Batch test configurations and grouped test execution |
| Recorder | Codegen capture and code refinement |
| Environments | Project-level environment configuration with variables |
| Block Library | Reusable block templates (core, plugin-contributed, and custom) |
| Plugins | Global plugin manager and project integration controls |
| Settings | Application and project preferences |

## Non-Goals (v1)

- Not a replacement for the Playwright CLI
- Not a cloud-hosted service
- No plaintext secret storage
- No separate executable block runtime
- No multi-user or remote access model

## Target Users

Developers and QA engineers who use Playwright Test and want a local orchestration UI, including visual authoring and project-specific plugin tooling.

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Local server | Express + TypeScript |
| Browser UI | React + TypeScript |
| Realtime push | WebSocket (`ws`) |
| Database | SQLite (`better-sqlite3`) |
| Secrets | `keytar` |
| File watching | `chokidar` |
| Automation | Local Playwright binary |
| Build | Vite (renderer) + `tsc` (server) |
