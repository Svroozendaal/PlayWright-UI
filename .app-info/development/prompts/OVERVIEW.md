# PROMPTS — PW Studio

## Available Prompts

| Prompt | File | Phase | Milestone |
|---|---|---|---|
| Foundation | `PHASE_1_FOUNDATION.md` | 1 | App starts, IPC locked, project CRUD works |
| Project Lifecycle + Health | `PHASE_2_PROJECT_LIFECYCLE.md` | 2 | Wizard, health checks, force run escape |
| Explorer Foundation | `PHASE_3_EXPLORER.md` | 3 | Live file tree, test detection, auto-refresh |
| Run Engine | `PHASE_4_RUN_ENGINE.md` | 4 | Run tests, stream logs, cancel, rerun |
| Artifact Layer | `PHASE_5_ARTIFACTS.md` | 5 | Artifact policies, rerunFailed, CLI flag mapping |
| Environments + Secrets + Recorder | `PHASE_6_ENVIRONMENTS.md` | 6 | Environments, keychain secrets, codegen |
| Packaging + Polish | `PHASE_7_PACKAGING.md` | 7 | Windows .exe, error screens, documentation |
| Dashboard, Editor + UX Overhaul | `PHASE_8_UX_OVERHAUL.md` | 8 | Sidebar nav, dashboard, code editor, quick run, explorer polish |

## Execution Order

Phases 1–7 are sequential.
**Exception:** Start Phase 4 (Run Engine PoC) parallel to Phase 3 as soon as the explorer shows one file.
Phase 8 follows after Phase 7 — it is a UX overhaul pass over the complete app.

## Context Per Session

- Always load `.app-info/docs/PW_STUDIO_BLUEPRINT.md` as architecture reference.
- For later phases, also load the existing codebase context.

## Prompt Conventions

Each prompt:
1. Begins with the First Step Rule (read AGENTS.md, FRAMEWORK.md, ROUTING.md, blueprint).
2. Lists required skills to load.
3. Defines entry criteria (prerequisites).
4. Defines exit criteria (what must work).
5. Specifies implementation order.
