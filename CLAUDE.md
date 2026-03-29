# CLAUDE.md - PW Studio

## First Step Rule

Before acting on a prompt:

1. Read `.agents/AGENTS.md`
2. Read `.agents/FRAMEWORK.md`
3. Read `.app-info/ROUTING.md`
4. Ask clarifying workflow questions first
5. Confirm assumptions before changing files

## Project Identity

- App: PW Studio
- Purpose: local web application for Playwright Test orchestration
- Blueprint: `.app-info/docs/PW_STUDIO_BLUEPRINT.md`

## Runtime Model

- Express server + React SPA
- REST API + WebSocket push events
- SQLite, `keytar`, `chokidar`, local Playwright binary
- Plugin-first backend with project-level plugin enablement

## Core Conventions

- Use UK English in documentation.
- Use the local Playwright binary, never `npx playwright`.
- Keep `.spec.ts` files as the only executable source of truth.
- Route system-specific behaviour through plugins when possible.
- Keep secrets in the OS keychain only.
- Use `npm run dev` for local development and `npm run build` for production builds.

## Main Areas

- `src/server/`: server runtime, routes, services, plugin runtime
- `src/renderer/`: React UI
- `src/shared/`: shared contracts and types
- `plugins/`: shipped local plugins

## Important User-Facing Features

- project creation and import
- health checks
- explorer and code editing
- run orchestration and artefacts
- recorder refinement
- visual block editor
- global block library
- plugin manager and project integrations
