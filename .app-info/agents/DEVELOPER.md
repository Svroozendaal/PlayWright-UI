# DEVELOPER — PW Studio Extension

## Extends: `.agents/agents/DEVELOPER.md`

## App-Specific Conventions

### API
- Every route returns `ApiEnvelope<T>` — never raw values.
- Never throw uncaught errors from route handlers — map them to envelope errors.
- Use `API_ROUTES.*` and `WS_EVENTS.*` constants — never string literals.
- One route file per domain in `src/server/routes/`.

### Services
- All services live in `src/server/services/`.
- Services receive dependencies via constructor (`db`, `broadcast`, `events`, other services).
- New services must be added to `ServiceContainer`.
- Services are created once in `createServices()` — no singletons or static state.

### Database
- Every schema change = new migration (never modify existing).
- Migrations are append-only in `src/server/db/migrations.ts`.
- All queries use prepared statements.
- Wrap multi-step writes in transactions.

### Paths
- Always `path.join()` or `path.resolve()` — never concatenate.
- Always use the platform path helpers from the server runtime — never hardcode system directories.
- Never hardcode `tests/` — use `configSummary.testDir`.

### Process Spawning
- Use local Playwright binary (`node_modules/.bin/playwright.cmd` on Windows).
- `shell: false` by default.
- Use `taskkill /T /F` for kill on Windows when process tree shutdown is required.

### TypeScript
- Strict mode, no `any`.
- Types shared between server and renderer live in `src/shared/types/`.
- Server-only types live alongside their services.
