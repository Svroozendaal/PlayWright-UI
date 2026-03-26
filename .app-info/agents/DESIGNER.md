# DESIGNER — PW Studio Extension

## Extends: `.agents/agents/DESIGNER.md`

## App-Specific Conventions

### Renderer Architecture
- All UI code in `src/renderer/src/`.
- React with TypeScript — no `any`.
- `HashRouter` from `react-router-dom` (Electron-compatible).
- Access main process ONLY via `window.api.invoke()` / `window.api.on()` / `window.api.off()`.

### IPC in Components
- Always clean up push event listeners: `off()` in useEffect cleanup.
- Type responses using `IpcEnvelope<T>`.
- Handle both `payload` and `error` from every invoke response.

### Component Patterns
- Pages in `src/renderer/src/pages/`.
- Reusable components in `src/renderer/src/components/`.
- Custom hooks in `src/renderer/src/hooks/`.
- State management in `src/renderer/src/store/`.

### Screens (from blueprint section 15)
| Screen | Route | Phase |
|---|---|---|
| Projects | `/` | 1 |
| Dashboard | `/project/:id` | 2 |
| Explorer | `/project/:id/explorer` | 3 |
| Runs | `/project/:id/runs` | 4 |
| Run Detail | `/project/:id/runs/:runId` | 4 |
| Recorder | `/project/:id/recorder` | 6 |
| Settings | `/settings` | 1 (basic), 6 (environments) |

### UI Principles
- Graceful degradation — parse errors don't break the explorer.
- Health errors disable run buttons but show "Force run" escape.
- Live refresh on push events — no full page reload.
- Scroll-to-bottom for log streaming (unless user scrolled up).
