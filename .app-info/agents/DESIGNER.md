# DESIGNER — PW Studio Extension

## Extends: `.agents/agents/DESIGNER.md`

## App-Specific Conventions

### Renderer Architecture
- All UI code lives in `src/renderer/src/`.
- React with TypeScript — no `any`.
- `BrowserRouter` from `react-router-dom`.
- Access the backend only via the fetch client in `src/renderer/src/api/client.ts` and WebSocket helpers in `src/renderer/src/api/useSocket.ts`.

### API in Components
- Handle both `payload` and `error` from every API call.
- Use `useSocketEvent()` for push updates and rely on hook cleanup.
- Keep route paths and event names in shared constants.

### Component Patterns
- Pages in `src/renderer/src/pages/`.
- Reusable components in `src/renderer/src/components/`.
- API helpers in `src/renderer/src/api/`.
- State kept local unless a shared store is clearly needed.

### Screens
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
- Graceful degradation — parse errors do not break the explorer.
- Health errors disable run buttons but show a "Force run" escape.
- Live refresh on push events — no full page reload.
- Scroll to bottom for log streaming unless the user has scrolled up.
