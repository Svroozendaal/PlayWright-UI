# PHASE 2 — Project Lifecycle + Health

## Context

Phase 1 is complete: the local server runs, the registry works, SQLite is set up, and the browser UI can create or import projects through the API.

## Required Skills

- `.app-info/skills/rest-websocket-api/SKILL.md`
- `.app-info/skills/playwright-binary/SKILL.md`
- `.app-info/skills/playwright-config-reader/SKILL.md`
- `.app-info/skills/path-safety/SKILL.md`

## Deliverables

1. Project template generation and import checks
2. Project open flow over REST
3. Playwright health checks with caching and refresh route
4. Health panel wired to API routes and push refresh events
5. Settings updates for per-project defaults

## Rules

- Keep health responses inside `ApiEnvelope<T>`
- Use config-summary caching, not hardcoded folder assumptions
- Surface actionable health warnings in the UI
