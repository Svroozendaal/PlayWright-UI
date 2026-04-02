# CONFIG - PW Studio

## Technology Stack

| Layer | Technology |
|---|---|
| Local server | Express + TypeScript |
| Browser UI | React + TypeScript |
| Realtime push | WebSocket (`ws`) |
| Database | SQLite (`better-sqlite3`) |
| Secrets | `keytar` |
| File watching | `chokidar` |
| Automation | local Playwright binary |
| Packaging | `npm` + bundled Node runtime |

## Runtime Layout

```text
pw-studio/
|-- plugins/                 # shipped local plugins
|-- src/
|   |-- server/
|   |   |-- plugins/        # runtime, loader, core registrations
|   |   |-- routes/
|   |   |-- services/
|   |   |-- db/
|   |   |-- middleware/
|   |   `-- utils/
|   |-- renderer/
|   `-- shared/
`-- sample-project/
```

## Runtime Rules

- Bind the server to `127.0.0.1`.
- Serve the built SPA from the same server in production.
- Use Vite proxying in development.
- Keep plugin installation app-wide and plugin enablement project-specific.
- Use file-backed project plugin config under `.pw-studio/plugins/`.

## Environment Variables

- `PORT` — optional local server port override (default 3000)
- `PW_STUDIO_PLUGIN_DIRS` — optional extra plugin directories (comma-separated paths)
- `PWSTUDIO_EXTRACT=1` — config extraction hint for Playwright config reading

## Development Commands

- `npm run dev` — start server with file watch and Vite frontend
- `npm run build` — build SPA and compile server TypeScript
- `npm run preview` — preview production build with server
- `npm run typecheck` — validate all TypeScript files
- `npm run bundle:runtime` — package server and Node.js into distributable archive
