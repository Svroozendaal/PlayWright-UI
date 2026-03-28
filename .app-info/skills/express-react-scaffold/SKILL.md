# SKILL: Express + React + TypeScript Scaffold

## Purpose

Conventions and rules for setting up and maintaining the local server plus React SPA structure for PW Studio.

## When to Use

- Phase 1: Initial project scaffolding
- Any time entry points or build configuration changes

## Tooling

Use:

- `vite` for the renderer
- `tsx` for local server development
- `tsc` for server builds
- `concurrently` to run Vite and the local server together in development

## Directory Structure

```text
pw-studio/
  vite.config.ts
  package.json
  src/
    server/
      index.ts
      ws.ts
      routes/
      services/
      db/
      middleware/
      plugins/
      utils/
    renderer/
      public/
      src/
        api/
        App.tsx
        main.tsx
        components/
        pages/
    shared/
      types/
```

## Development Workflow

```json
{
  "scripts": {
    "dev": "concurrently \"tsx watch src/server/index.ts\" \"vite\"",
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js"
  }
}
```

## Rules

1. Keep server and renderer entry points separate.
2. Serve the built SPA from the same local server in production.
3. Use `BrowserRouter`.
4. Keep Node-only code in `src/server/`.
5. Keep shared transport and domain types in `src/shared/types/`.
