# SKILL: REST API + WebSocket Conventions

## Purpose

Rules for request/response and push communication in PW Studio's web architecture.

## When to Use

- Every phase after the web migration
- When adding API routes, push events, or route schemas

## Envelope Pattern

All route responses use a typed envelope:

```ts
export type ApiEnvelope<T> = {
  version: 1
  payload?: T
  error?: { code: string; message: string }
}

export type IpcEnvelope<T> = ApiEnvelope<T>
```

Rules:

- Every route returns `ApiEnvelope<T>`, never a raw value
- On success: `{ version: 1, payload: result }`
- On error: `{ version: 1, error: { code, message } }`
- Keep `ERROR_CODES` centralised in `src/shared/types/ipc.ts`

## Route Constants

Define request routes and push events separately:

```ts
export const API_ROUTES = { /* ... */ } as const
export const WS_EVENTS = { /* ... */ } as const
```

Never use string literals in renderer or server code when a shared constant exists.

## Route Pattern

- One route file per domain in `src/server/routes/`
- Central registration in `src/server/routes/index.ts`
- Validate params, query, and body at the boundary
- Route registry should also feed OpenAPI generation

## Push Event Pattern

- WebSocket endpoint: `/ws`
- Message shape: `{ channel, data }`
- Use a singleton socket in the renderer
- Subscribe through a hook and clean up automatically on unmount

## Rules

1. Preserve stable envelope shapes.
2. Keep errors actionable and predictable.
3. Validate inputs before touching SQL, paths, or child processes.
4. Reuse event names where possible to reduce migration churn.
5. Register OpenAPI metadata from the same source as the runtime route registration.
