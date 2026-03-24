# DEVELOPMENT — PW Studio

## Structure

- `prompts/` — Development phase prompts and task prompts.
- `commands/` — App-specific command guidance.

## Conventions

- All code in TypeScript (strict mode).
- Main process code in `src/main/`.
- Renderer code in `src/renderer/`.
- Shared types in `src/shared/`.
- Preload script in `src/preload/`.
- IPC uses the envelope pattern (`IpcEnvelope<T>`).
- SQLite migrations are sequential and append-only.
