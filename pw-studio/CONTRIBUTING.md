# Contributing to PW Studio

## Development Setup

```bash
git clone <repo-url>
cd pw-studio
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm run build
```

## Project Shape

```text
pw-studio/
|-- plugins/                 # shipped local plugins
|-- src/
|   |-- server/
|   |   |-- db/
|   |   |-- middleware/
|   |   |-- plugins/        # loader, runtime, core registrations
|   |   |-- routes/
|   |   |-- services/
|   |   |-- utils/
|   |   |-- index.ts
|   |   `-- ws.ts
|   |-- renderer/
|   |   |-- public/
|   |   `-- src/
|   |       |-- api/
|   |       |-- components/
|   |       `-- pages/
|   `-- shared/
|       `-- types/
`-- sample-project/
```

## Contribution Rules

- Use UK English in documentation.
- Keep Playwright execution on the local binary, not `npx`.
- Treat the `.spec.ts` file as the only runnable source of truth.
- Add system-specific behaviour through plugins where possible.
- Register new block kinds through the plugin runtime, not editor-side hardcoded switches.
- Keep per-project plugin state file-backed under `.pw-studio/plugins/`.

## Adding Core Features

### Add a route

1. Add the route constant in `src/shared/types/ipc.ts`.
2. Add or update the route file in `src/server/routes/`.
3. Register it from `src/server/routes/index.ts`.
4. Validate inputs at the route boundary.

### Add a plugin capability

1. Extend `src/server/plugins/runtime.ts`.
2. Keep the capability generic enough for multiple plugins.
3. Register built-in behaviour through `src/server/plugins/core.ts` where needed.
4. Document the new extension point in the blueprint and architecture docs.

### Add a new block kind

Prefer a plugin.

1. Register a `BlockDefinition` and optional template through the plugin runtime.
2. Implement server-side parse/render logic in the plugin or core registration.
3. Ensure the block maps back to normal Playwright code.
4. Update the block library documentation if the block is user-facing.
