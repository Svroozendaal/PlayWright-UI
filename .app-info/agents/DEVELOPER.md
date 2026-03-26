# DEVELOPER — PW Studio Extension

## Extends: `.agents/agents/DEVELOPER.md`

## App-Specific Conventions

### IPC
- Every handler returns `IpcEnvelope<T>` — never raw values.
- Never throw from handlers — catch and return error envelopes.
- Use `IPC.*` constants — never string literals for channels.
- One handler file per domain in `src/main/ipc/`.

### Services
- All services live in `src/main/services/`.
- Services receive dependencies via constructor (db, win, other services).
- New services must be added to `ServiceContainer`.
- Services are created once in `createServices()` — no singletons or static state.

### Database
- Every schema change = new migration (never modify existing).
- Migrations are append-only in `src/main/db/migrations.ts`.
- All queries use prepared statements.
- Wrap multi-step writes in transactions.

### Paths
- Always `path.join()` — never concatenate.
- Always `app.getPath()` — never hardcode system directories.
- Never hardcode `tests/` — use `configSummary.testDir`.

### Process Spawning
- Use local Playwright binary (`node_modules/.bin/playwright.cmd` on Windows).
- `shell: false` by default.
- Use `taskkill /T /F` for kill on Windows.

### TypeScript
- Strict mode, no `any`.
- Types shared between main/renderer live in `src/shared/types/`.
- Main-only types live alongside their services.
