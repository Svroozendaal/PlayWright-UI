# Contributing to PW Studio

## Development Setup

```bash
# Clone the repository
git clone <repo-url>
cd pw-studio

# Install dependencies (triggers electron-rebuild for native modules)
npm install

# Start development mode with hot reload
npm run dev
```

## Build Instructions

```bash
# Type check (both node and web configs)
npm run typecheck

# Build the Electron app
npm run build

# Package for Windows — creates NSIS installer + portable .exe
npm run build:win

# Package portable only
npm run build:win:portable
```

Output is written to `dist/`.

## Directory Structure

```
pw-studio/
├── src/
│   ├── main/                  # Electron main process (Node.js)
│   │   ├── db/                # SQLite database, migrations
│   │   ├── ipc/               # IPC handler registrations (one file per domain)
│   │   ├── services/          # Business logic services
│   │   ├── utils/             # Playwright binary detection, config reader
│   │   └── index.ts           # App entry point
│   ├── preload/               # contextBridge (preload script)
│   │   ├── index.ts           # Exposes window.api
│   │   └── index.d.ts         # Type declarations for renderer
│   ├── renderer/              # React UI
│   │   └── src/
│   │       ├── pages/         # Route pages
│   │       ├── components/    # Reusable UI components
│   │       ├── App.tsx        # Router setup
│   │       ├── App.css        # Global styles
│   │       └── main.tsx       # React entry point
│   └── shared/                # Types shared between main and renderer
│       └── types/
│           └── ipc.ts         # IpcEnvelope, IPC channels, domain types
├── resources/                 # Build resources (icons)
├── sample-project/            # Example Playwright project shipped with the app
├── electron.vite.config.ts    # Vite config for main/preload/renderer
├── electron-builder.yml       # Packaging configuration
├── tsconfig.json              # Base TypeScript config
├── tsconfig.node.json         # Main + preload TypeScript config
└── tsconfig.web.json          # Renderer TypeScript config
```

For the full architecture, see `ARCHITECTURE.md` and the blueprint at `.app-info/docs/PW_STUDIO_BLUEPRINT.md`.

## How to Add a New Service

1. Create `src/main/services/YourService.ts` with a class that takes its dependencies via the constructor.
2. Add the service to `ServiceContainer` in `src/main/services/ServiceContainer.ts`.
3. Wire it up in `createServices()`.

## How to Add an IPC Channel

1. Add the channel constant to `src/shared/types/ipc.ts` under the `IPC` object.
2. Create a handler file in `src/main/ipc/` (or add to an existing domain file).
3. Register the handler in `src/main/ipc/index.ts` via `registerAllHandlers()`.
4. All handlers must return an `IpcEnvelope<T>` — use `ERROR_CODES` for error responses.

## Conventions

- **UK English** in all documentation.
- Use the **local Playwright binary** (`node_modules/.bin/playwright`), never `npx`.
- `--reporter=json` is the standard parseable output.
- All secrets via **OS keychain** (keytar) — no plaintext fallback.
- IPC uses the **envelope pattern** (`IpcEnvelope<T>`).
- Always use `path.join()` — never string concatenation for paths.
- Always use `app.getPath()` — never hardcoded system paths.
