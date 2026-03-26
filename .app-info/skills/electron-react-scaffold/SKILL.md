# SKILL: Electron + React + TypeScript Scaffold

## Purpose

Conventions and rules for setting up and maintaining the Electron + React + TypeScript project structure for PW Studio.

## When to Use

- Phase 1: Initial project scaffolding
- Any time new entry points or build configuration changes are needed

## Tooling

**Use `electron-vite`** (package: `electron-vite`, docs: electron-vite.org) as the build and dev tool.

Scaffold command:
```bash
npm create @electron-vite/app@latest pw-studio -- --template react-ts
```

Target package versions:
| Package | Version |
|---|---|
| electron | ^33+ |
| electron-vite | ^2.x+ |
| vite | ^6.x |
| @vitejs/plugin-react | ^4.x |
| react / react-dom | ^19.x |
| typescript | ^5.6+ |
| @electron-toolkit/utils | ^2.x |
| electron-builder | ^25.x |

## Directory Structure

```
pw-studio/
  electron.vite.config.ts       # single config with main/preload/renderer sections
  package.json
  src/
    main/                        # Main process (Node.js)
      index.ts                   # BrowserWindow creation, app lifecycle
      ipc/                       # IPC handlers, one file per domain
      services/                  # All services
      db/                        # Database + migrations
      utils/                     # Utilities (playwrightBinary, etc.)
    preload/
      index.ts                   # contextBridge — the ONLY bridge
    renderer/
      src/
        App.tsx
        main.tsx                 # React entry point
        components/
        pages/
        hooks/
        store/
      index.html
    shared/
      types/                     # ipc.ts, domain types
      constants/
  resources/
    icon.ico
```

## electron.vite.config.ts

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()]
  }
})
```

**CRITICAL:** `externalizeDepsPlugin()` is mandatory for main/preload — prevents Vite from bundling native Node modules (like `electron`, `better-sqlite3`) into the output.

## TypeScript Configuration

Separate tsconfig files per process:

**tsconfig.json (root — base config):**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

**tsconfig.node.json (main + preload):**
- `lib: ["ESNext"]` — NO `DOM` (catches accidental browser API use in main)
- `types: ["electron-vite/node"]`
- Includes: `src/main/**/*`, `src/preload/**/*`, `src/shared/**/*`

**tsconfig.web.json (renderer):**
- `lib: ["ESNext", "DOM", "DOM.Iterable"]`
- `jsx: "react-jsx"`
- `types: ["electron-vite/client"]`
- Includes: `src/renderer/src/**/*`, `src/shared/**/*`

## BrowserWindow Security Settings

```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
  }
})
```

**NEVER set `nodeIntegration: true` or `contextIsolation: false`.**

## Dev vs Prod URL Loading

```typescript
import { is } from '@electron-toolkit/utils'

if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
  mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
} else {
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}
```

## Hot Reload

electron-vite handles this out of the box:
- **Renderer:** Vite dev server with React Fast Refresh (instant HMR)
- **Main process:** File watcher triggers full Electron restart
- **Preload:** Recompiled on change, renderer window reloads

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview"
  }
}
```

## Rules

1. **Never import Node.js modules in renderer code.** Use IPC for all main process access.
2. **Never import DOM/browser APIs in main process code.** Separate tsconfigs enforce this.
3. **Always use `externalizeDepsPlugin()`** in main/preload Vite configs.
4. **CSP is relaxed in dev mode** by electron-vite — production builds need strict CSP.
5. **Keep main process code minimal** — changes cause full restart, not HMR.
6. **`shared/` is the only code shared** between main and renderer (types, constants).
