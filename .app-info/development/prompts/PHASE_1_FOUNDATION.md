# PHASE 1 — Foundation

## First Step

1. Read `.agents/AGENTS.md`.
2. Read `.agents/FRAMEWORK.md`.
3. Read `.app-info/ROUTING.md`.
4. Read `.app-info/docs/PW_STUDIO_BLUEPRINT.md`.

## Agent Routing

- **Architect** — service container, transport contracts, path strategy
- **Developer** — server bootstrap, SQLite, routes, settings, registry
- **Designer** — SPA shell, router, projects screen, folder picker UX
- **Tester** — validation of the startup and project flows

Sequence: Architect -> Developer -> Designer -> Tester.

## Required Skills

- `.app-info/skills/express-react-scaffold/SKILL.md`
- `.app-info/skills/rest-websocket-api/SKILL.md`
- `.app-info/skills/sqlite-migrations/SKILL.md`
- `.app-info/skills/path-safety/SKILL.md`
- `.agents/skills/code-quality/SKILL.md`

## Goal

A working local web application with an Express server, React SPA, SQLite, shared transport contracts, project registry, and basic settings.

## Deliverables

1. Vite renderer build plus server TypeScript build
2. `src/server/index.ts` bootstrap with graceful shutdown
3. `ApiEnvelope<T>` and route/event constants in `src/shared/types/ipc.ts`
4. SQLite bootstrap and migration runner in `src/server/db/`
5. `ServiceContainer` wired without any window dependency
6. Project registry routes and service
7. Browser router and projects screen
8. Directory browser API plus UI component

## Exit Criteria

- `npm run dev` starts server and Vite successfully
- Project creation and import work through the browser UI
- Projects persist across restart
- Route and event constants are defined for future phases
- TypeScript compiles in strict mode
