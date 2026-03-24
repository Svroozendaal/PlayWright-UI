# CONFIG — PW Studio

## Technology Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| UI | React + TypeScript |
| Backend/services | Node.js + TypeScript (main process) |
| Database | SQLite (better-sqlite3) |
| File watching | chokidar |
| Secrets | keytar (OS keychain) |
| Automation | Local Playwright binary |
| Packaging | electron-builder |

## System Requirements

- **Node.js:** minimum 18.x
- **Playwright:** minimum 1.40.0
- **Platform:** Windows (v1)

## Project Structure

```
pw-studio/
├── src/
│   ├── main/           ← Electron main process
│   │   ├── ipc/        ← IPC handlers
│   │   ├── services/   ← All 10 services
│   │   ├── db/         ← migrations.ts, schema.ts
│   │   └── utils/      ← playwrightBinary.ts, playwrightConfigReader.ts
│   ├── preload/
│   │   └── index.ts    ← contextBridge
│   ├── renderer/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── store/
│   └── shared/
│       ├── types/      ← ipc.ts, domain types
│       └── constants/
├── resources/
│   └── icon.ico
├── package.json
└── electron-builder.yml
```

## Environment Variables

- `PWSTUDIO_EXTRACT: '1'` — used during config extraction to identify extraction context.
