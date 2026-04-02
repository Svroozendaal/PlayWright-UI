# DOCS - PW Studio

## Available Documentation

| Document | Purpose |
|---|---|
| `PW_STUDIO_BLUEPRINT.md` | Complete architecture reference including runtime topology, transport, API surface, backend services, plugin contract, database schema, build phases, and technical debt. **Read this first** for system understanding. |

## Quick Navigation

| Topic | Reference |
|---|---|
| Architecture & topology | Blueprint § 1–6, 11 |
| API routes and contracts | Blueprint § 10, shared types at `/src/shared/types/ipc.ts` |
| Database and persistence | Blueprint § 12, migrations at `/src/server/db/migrations.ts` |
| Plugin runtime | Blueprint § 8, core definitions at `/src/server/plugins/core.ts` |
| Block authoring and subflows | Blueprint § 7.6, AST utilities at `/src/server/utils/testEditorAst.ts` |
| Services directory | Blueprint § 11, all services at `/src/server/services/` |
| Routes directory | Blueprint § 10, all routes at `/src/server/routes/` |
| Styling and UX | Blueprint § 17, tokens and components at `/src/renderer/src/App.css` |
| Phase status | Blueprint § 16, product plan at `.app-info/app/PRODUCT_PLAN.md` |

## Documentation Conventions

- Keep these docs aligned with the real codebase.
- Use UK English.
- Treat the blueprint as the main source of truth for architecture and extension points.
- Update this folder when new user-facing systems land, especially plugins, block authoring, recorder changes, and packaging changes.
- Cross-reference actual file paths when describing implementation details; do not copy code blocks into docs unless essential.
