# SKILL: Electron IPC Conventions

## Purpose

Rules for all IPC communication in PW Studio: the envelope pattern, preload/contextBridge, handler registration, and push events.

## When to Use

- Every phase — this is the communication backbone of the app
- When adding new IPC channels
- When implementing push events (log streaming, status changes)

## The IpcEnvelope Pattern

All IPC responses use a typed envelope:

```typescript
// src/shared/types/ipc.ts
export type IpcEnvelope<T> = {
  version: 1
  payload?: T
  error?: { code: string; message: string }
}
```

**Rules:**
- Every handler returns `IpcEnvelope<T>`, never a raw value.
- On success: `{ version: 1, payload: result }`
- On error: `{ version: 1, error: { code: 'ERROR_CODE', message: 'Human-readable message' } }`
- Never throw from an IPC handler — always catch and return an envelope with error.

## IPC Channel Constants

All channels defined in one place:

```typescript
// src/shared/types/ipc.ts
export const IPC = {
  PROJECTS_LIST:            'projects:list',
  PROJECTS_CREATE:          'projects:create',
  // ... all channels from the blueprint section 4
} as const
```

**Rule:** Never use string literals for channels — always reference `IPC.*`.

## Preload Script

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  invoke: <T>(channel: string, payload?: unknown): Promise<IpcEnvelope<T>> =>
    ipcRenderer.invoke(channel, { version: 1, payload }),

  on: (channel: string, handler: (data: unknown) => void): void => {
    ipcRenderer.on(channel, (_e, data) => handler(data))
  },

  off: (channel: string, handler: (data: unknown) => void): void => {
    ipcRenderer.removeListener(channel, handler)
  },
})
```

**Security rules:**
- Never expose `ipcRenderer` directly.
- Never expose `ipcRenderer.send` — use `invoke` (request/response) or `on`/`off` (push events) only.
- All three methods (`invoke`, `on`, `off`) must be present. `off()` is required for useEffect cleanup.

## Type Declaration for Renderer

```typescript
// src/preload/index.d.ts or src/renderer/src/env.d.ts
import type { IpcEnvelope } from '../shared/types/ipc'

declare global {
  interface Window {
    api: {
      invoke: <T>(channel: string, payload?: unknown) => Promise<IpcEnvelope<T>>
      on: (channel: string, handler: (data: unknown) => void) => void
      off: (channel: string, handler: (data: unknown) => void) => void
    }
  }
}
```

## Handler Registration Pattern

One handler file per domain in `src/main/ipc/`:

```typescript
// src/main/ipc/projectHandlers.ts
import { ipcMain } from 'electron'
import { IPC, IpcEnvelope } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerProjectHandlers(services: ServiceContainer): void {
  ipcMain.handle(IPC.PROJECTS_LIST, async (): Promise<IpcEnvelope<Project[]>> => {
    try {
      const projects = services.projectRegistry.listProjects()
      return { version: 1, payload: projects }
    } catch (err) {
      return { version: 1, error: { code: 'UNKNOWN', message: String(err) } }
    }
  })
}
```

**Rules:**
- Each handler file exports a single `register*Handlers(services)` function.
- All handlers registered in `registerAllHandlers()` called from `src/main/index.ts`.
- Handlers always wrap in try/catch and return error envelopes.

## Push Events (Main → Renderer)

For streaming data (logs, status changes), main pushes via `webContents.send()`:

```typescript
// In a service:
this.win.webContents.send(IPC.RUNS_LOG_EVENT, logEvent)
```

**Renderer pattern:**
```tsx
useEffect(() => {
  const handler = (data: LogEvent) => { /* update state */ }
  window.api.on(IPC.RUNS_LOG_EVENT, handler)
  return () => window.api.off(IPC.RUNS_LOG_EVENT, handler)
}, [])
```

**CRITICAL:** Always call `off()` in the useEffect cleanup. Memory leaks from forgotten listeners are a common Electron bug.

## Error Code Constants

```typescript
export const ERROR_CODES = {
  PROJECT_NOT_FOUND:        'PROJECT_NOT_FOUND',
  PROJECT_EXISTS:           'PROJECT_EXISTS',
  HEALTH_CHECK_FAILED:      'HEALTH_CHECK_FAILED',
  CONFIG_NOT_READABLE:      'CONFIG_NOT_READABLE',
  ACTIVE_RUN_EXISTS:        'ACTIVE_RUN_EXISTS',
  RUN_NOT_FOUND:            'RUN_NOT_FOUND',
  SECRETS_UNAVAILABLE:      'SECRETS_UNAVAILABLE',
  ENVIRONMENT_NOT_FOUND:    'ENVIRONMENT_NOT_FOUND',
  RECORDER_ALREADY_RUNNING: 'RECORDER_ALREADY_RUNNING',
} as const
```

## React Router in Electron

Use `HashRouter` from `react-router-dom` — Electron's `file://` protocol does not support `BrowserRouter`:

```tsx
import { HashRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/project/:id" element={<DashboardPage />} />
        {/* ... */}
      </Routes>
    </HashRouter>
  )
}
```

## Rules

1. **Every IPC response is an `IpcEnvelope<T>`** — no exceptions.
2. **Never use string literals for channels** — always `IPC.*`.
3. **Never expose raw `ipcRenderer`** to the renderer.
4. **Always `off()` in useEffect cleanup** — prevents memory leaks.
5. **Handlers never throw** — catch errors and return error envelopes.
6. **One handler file per domain** — keeps registration clean and testable.
