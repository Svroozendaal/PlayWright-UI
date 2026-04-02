# DEVELOPMENT PROMPTS - PW Studio

## Prompt Catalogue

| Prompt | File | Purpose |
|---|---|---|
| Foundation | `PHASE_1_FOUNDATION.md` | Server, SPA, transport contracts, project registry |
| Project Lifecycle + Health | `PHASE_2_PROJECT_LIFECYCLE.md` | Template generation, import/open flow, health checks |
| Explorer | `PHASE_3_EXPLORER.md` | File watching, indexing, explorer UI, file operations |
| Run Engine | `PHASE_4_RUN_ENGINE.md` | Run orchestration, logs, result persistence |
| Artifacts | `PHASE_5_ARTIFACTS.md` | Artefact policies and rerun flows |
| Environments + Secrets + Recorder | `PHASE_6_ENVIRONMENTS.md` | Environment management, secrets, recorder flows |
| Packaging + Polish | `PHASE_7_PACKAGING.md` | packaging, bundled runtime, docs |
| Dashboard, Editor + UX Overhaul | `PHASE_8_UX_OVERHAUL.md` | dashboard, editor UX, higher-level polish |
| Improve Codegen | `FEATURE_IMPROVE_CODEGEN.md` | recorder refinement, block-editor follow-up, generated-test ergonomics |
| Migration Plan | `Migration_plan.md` | architecture pivot and migration checklist |

## Phase Status

| Phase | Status | Key Deliverables |
|---|---|---|
| 1 | Complete | Express server, React SPA, REST API + WebSocket, settings |
| 2 | Complete | Project creation, import, health checks |
| 3 | Complete | File explorer, code editor, test indexing |
| 4 | Complete | Run orchestration, log streaming, result persistence |
| 5 | Complete | Artefact management, policies, rerun flows |
| 6 | Complete | Environments, secrets, recorder |
| 7 | Complete | Packaging, OpenAPI, plugin runtime, bundled distribution |
| 8 | In Progress | UX redesign, block editor enhancements, suites, styling |

## Notes

- These prompts describe the build history and implementation structure.
- The current app includes the plugin runtime, visual block editor, block library, project integrations, and the Mendix plugin on top of the foundational platform.
- The `Migration_plan.md` documents the historical Electron-to-web architecture pivot; this work has been completed.
- `FEATURE_IMPROVE_CODEGEN.md` documents the recorder refinement strategy; this work has been completed and is maintained as part of the block editor and plugin systems.
