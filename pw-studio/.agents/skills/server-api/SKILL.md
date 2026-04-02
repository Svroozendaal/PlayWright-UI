# SKILL: server-api

## Purpose

Ensure all Express routes and WebSocket events in PW Studio follow the shared envelope and event contracts consistently.

## When to Use

- Adding or modifying a REST route in `src/server/routes/`.
- Adding or consuming a WebSocket push event.
- Designing a new API surface or modifying an existing one.

## Procedure

### REST Routes

1. Place the route handler in `src/server/routes/` — one file per domain area.
2. Register the route in the main server entry (`src/server/index.ts` or the route loader).
3. Use the `ApiEnvelope<T>` response shape for every response:
   ```ts
   import { ApiEnvelope } from '../../shared/types/ipc'

   // Success
   res.json({ version: 1, payload: result } satisfies ApiEnvelope<T>)

   // Error
   res.status(400).json({ version: 1, error: { code: 'ERR_CODE', message: 'Human-readable message' } } satisfies ApiEnvelope<never>)
   ```
4. Validate all route params, query parameters, and request body at the boundary before passing to the service layer.
5. Keep route handlers thin — call a service function for all business logic.
6. Use constants from `API_ROUTES` in `src/shared/types/ipc.ts` for route paths — do not hardcode strings.
7. Use constants from `ERROR_CODES` for error codes — do not invent new codes without adding them to the shared constants.

### WebSocket Events

1. Push events use `SocketMessage`:
   ```ts
   type SocketMessage = { channel: string; data: unknown }
   ```
2. Use constants from `WS_EVENTS` for channel names.
3. Emit on both the WebSocket transport and the server `EventEmitter` so plugins can subscribe:
   ```ts
   broadcast({ channel: WS_EVENTS.RUN_UPDATED, data: payload })
   emitter.emit(WS_EVENTS.RUN_UPDATED, payload)
   ```
4. Never emit raw objects without a channel name.

### Error Handling

- Never swallow errors silently.
- Return `error` in the envelope with a meaningful `code` and `message`.
- Log server-side errors with enough context to debug (do not log secrets or PII).

## Output / Expected Result

- A route that validates input, calls a service, and returns `ApiEnvelope<T>`.
- An error path that returns a structured envelope error with a known `ERROR_CODE`.
- Any new route path or error code registered in `src/shared/types/ipc.ts`.

## Notes

- The `IpcEnvelope<T>` alias in shared types is a compatibility shim — prefer `ApiEnvelope<T>` for new code.
- OpenAPI spec is auto-generated at `/api/openapi.json` — keep route definitions typed so the spec stays accurate.
