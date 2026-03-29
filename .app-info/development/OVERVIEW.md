# DEVELOPMENT - PW Studio

## Structure

- `prompts/` - development prompts and feature prompts
- `commands/` - app-specific command guidance

## Conventions

- Use TypeScript throughout the application.
- Keep server code in `src/server/`.
- Keep renderer code in `src/renderer/`.
- Keep shared contracts in `src/shared/`.
- Keep plugins under `plugins/` when they ship with the repo.
- Keep app-specific reusable guidance in `.app-info/skills/`.
- Keep `.spec.ts` files as the only runnable source of truth even when visual editing is available.
