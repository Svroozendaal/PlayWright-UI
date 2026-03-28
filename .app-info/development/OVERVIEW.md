# DEVELOPMENT — PW Studio

## Structure

- `prompts/` — Development phase prompts and task prompts.
- `commands/` — App-specific command guidance.

## Conventions

- All code in TypeScript (strict mode).
- Server code in `src/server/`.
- Renderer code in `src/renderer/`.
- Shared types in `src/shared/`.
- API uses the envelope pattern (`ApiEnvelope<T>`) over HTTP and WebSocket.
- SQLite migrations are sequential and append-only.
- `npm run dev` starts the local server and Vite dev server together.
