# ROUTING — PW Studio

## Master Navigation

This file is the entry point for all app-specific data. Read this after `.agents/AGENTS.md` and `.agents/FRAMEWORK.md`.

## Folder Map

| Folder | Purpose | Key Files |
|---|---|---|
| `.app-info/app/` | Application identity, vision, product plan | `OVERVIEW.md`, `PRODUCT_PLAN.md` |
| `.app-info/development/` | Development prompts, commands, resources | `OVERVIEW.md`, `prompts/OVERVIEW.md`, `commands/OVERVIEW.md` |
| `.app-info/skills/` | App-specific skills and domain rules | `OVERVIEW.md` |
| `.app-info/docs/` | Architecture docs and produced documentation | `OVERVIEW.md`, `PW_STUDIO_BLUEPRINT.md` |
| `.app-info/features/` | Feature registry — what the app does | `OVERVIEW.md`, `FEATURES.md` |
| `.app-info/memory/` | Live agent memory logs | `OVERVIEW.md`, `SESSION_STATE.md`, `DECISIONS_LOG.md`, `PROGRESS.md`, `REVIEW_NOTES.md`, `PROMPT_CHANGES.md`, `INCIDENTS.md` |
| `.app-info/config/` | Stack, environment, tool versions | `OVERVIEW.md` |
| `.app-info/agents/` | Agent extensions (optional) | `DESIGNER.md`, `DEVELOPER.md` |

## Quick References

- **Blueprint:** `.app-info/docs/PW_STUDIO_BLUEPRINT.md` — complete architecture, IPC channels, DB schema, service boundaries, build phases.
- **Build phases:** See blueprint sections 16 (Build Volgorde) — 7 phases from Foundation to Packaging.
- **IPC channels:** See blueprint section 4.
- **DB schema:** See blueprint section 13.
- **Service boundaries:** See blueprint section 12.
