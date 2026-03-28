# PHASE 7 — Packaging + Polish

## Agent Routing

- **Developer** — build config, path audit, error codes, OpenAPI, plugin loader
- **Designer** — settings polish, browser install cues, final UX gaps
- **Documenter** — README, CONTRIBUTING, ARCHITECTURE, blueprint alignment
- **Tester** — packaged build validation and path edge cases

## Required Skills

- `.app-info/skills/web-packaging/SKILL.md`
- `.app-info/skills/rest-websocket-api/SKILL.md`
- `.app-info/skills/path-safety/SKILL.md`
- `.agents/skills/documentation/SKILL.md`

## Goal

Ship PW Studio as a local web application with `npm` startup, bundled runtime output, PWA metadata, OpenAPI output, and final documentation.

## Deliverables

1. Final build scripts and bundled runtime output
2. Path audit
3. Error-code coverage in API responses and UI
4. SQLite location display in Settings
5. Plugin loading and `/api/openapi.json`
6. Public documentation refresh

## Exit Criteria

- Built app starts locally through the server runtime
- SPA, API, and WebSocket all work in production mode
- Plugin routes load at startup
- `/api/openapi.json` is served
