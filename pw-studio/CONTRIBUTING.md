# Contributing to PW Studio

## Development Setup

```bash
# Clone the repository
git clone <repo-url>
cd pw-studio

# Install dependencies
npm install

# Start local server + Vite
npm run dev
```

## Build Instructions

```bash
# Type check
npm run typecheck

# Build the SPA and server
npm run build

# Start the built app
npm start
```

## Directory Structure

```text
pw-studio/
├── src/
│   ├── server/                # Express server runtime
│   │   ├── db/                # SQLite database, migrations
│   │   ├── middleware/        # envelope + validation helpers
│   │   ├── plugins/           # plugin loading and activation
│   │   ├── routes/            # route registrations (one file per domain)
│   │   ├── services/          # business logic services
│   │   ├── utils/             # Playwright binary detection, config reader
│   │   ├── ws.ts              # WebSocket server
│   │   └── index.ts           # app entry point
│   ├── renderer/              # React UI
│   │   ├── public/            # static assets and PWA manifest
│   │   └── src/
│   │       ├── api/           # fetch client and socket hooks
│   │       ├── pages/         # route pages
│   │       ├── components/    # reusable UI components
│   │       ├── App.tsx        # router setup
│   │       ├── App.css        # global styles
│   │       └── main.tsx       # React entry point
│   └── shared/                # types shared between server and renderer
│       └── types/
│           └── ipc.ts         # envelope, route constants, event constants, domain types
├── sample-project/            # example Playwright project shipped with the app
├── vite.config.ts             # renderer build config
├── tsconfig.json              # base TypeScript config
├── tsconfig.server.json       # server TypeScript config
└── tsconfig.web.json          # renderer TypeScript config
```

For the full architecture, see `ARCHITECTURE.md` and the blueprint at `.app-info/docs/PW_STUDIO_BLUEPRINT.md`.

## How to Add a New Service

1. Create `src/server/services/YourService.ts` with constructor-injected dependencies.
2. Add the service to `ServiceContainer` in `src/server/services/ServiceContainer.ts`.
3. Wire it up in `createServices()`.

## How to Add a New Route

1. Add the route constant to `src/shared/types/ipc.ts` under `API_ROUTES`.
2. Create or update a route file in `src/server/routes/`.
3. Register the route from `src/server/routes/index.ts`.
4. Return `ApiEnvelope<T>` and use shared `ERROR_CODES`.
5. Add the schema to the route registry so it also appears in OpenAPI.

## Conventions

- **UK English** in all documentation.
- Use the **local Playwright binary** (`node_modules/.bin/playwright`), never `npx`.
- `--reporter=json` is the standard parseable output.
- All secrets use the **OS keychain** via `keytar`, with no plaintext fallback.
- API responses use the **envelope pattern** (`ApiEnvelope<T>`).
- Always use `path.join()` or `path.resolve()` for filesystem paths.
- Bind the local server to `127.0.0.1`.
