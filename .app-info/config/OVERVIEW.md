# CONFIG — PW Studio

## Technology Stack

| Layer | Technology |
|---|---|
| Local server | Express + TypeScript |
| UI | React + TypeScript |
| Realtime push | WebSocket (`ws`) |
| Database | SQLite (`better-sqlite3`) |
| File watching | chokidar |
| Secrets | `keytar` (OS keychain) |
| Automation | Local Playwright binary |
| Packaging | `npm` + bundled Node runtime |

## System Requirements

- **Node.js:** minimum 20.x
- **Playwright:** minimum 1.40.0
- **Platform:** Windows, macOS, and Linux for local development and local use

## Project Structure

```text
pw-studio/
├── src/
│   ├── server/
│   │   ├── routes/         ← Express route modules
│   │   ├── services/       ← Business logic services
│   │   ├── db/             ← database.ts, migrations.ts
│   │   ├── middleware/     ← envelope and validation helpers
│   │   ├── plugins/        ← plugin loader
│   │   ├── ws.ts           ← WebSocket server
│   │   └── index.ts        ← Express entry point
│   ├── renderer/
│   │   ├── public/         ← PWA manifest and static assets
│   │   └── src/
│   │       ├── api/        ← fetch client and socket hook
│   │       ├── components/
│   │       ├── pages/
│   │       └── main.tsx
│   └── shared/
│       └── types/          ← shared transport + domain types
├── vite.config.ts
├── tsconfig.server.json
├── tsconfig.web.json
├── package.json
└── sample-project/
```

## Runtime Rules

- The API and WebSocket server bind to `127.0.0.1`.
- Vite proxies `/api` and `/ws` to the local server in development.
- Production serves the built SPA from the same local server.
- No native-module rebuild postinstall step is required.

## Environment Variables

- `PORT` — optional local server port override
- `PWSTUDIO_EXTRACT=1` — used during config extraction to identify extraction context
