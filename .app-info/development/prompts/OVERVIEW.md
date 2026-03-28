# DEVELOPMENT PROMPTS — PW Studio

## Prompt Catalogue

| Prompt | File | Phase | Purpose |
|---|---|---|---|
| Foundation | `PHASE_1_FOUNDATION.md` | 1 | Server, SPA, transport contracts, project registry |
| Project Lifecycle + Health | `PHASE_2_PROJECT_LIFECYCLE.md` | 2 | Template generation, import/open flow, health checks |
| Explorer | `PHASE_3_EXPLORER.md` | 3 | File watching, indexing, tree UI, file operations |
| Run Engine | `PHASE_4_RUN_ENGINE.md` | 4 | Run orchestration, log streaming, run history |
| Artifacts | `PHASE_5_ARTIFACTS.md` | 5 | Artifact policies, reruns, artifact access |
| Environments + Secrets + Recorder | `PHASE_6_ENVIRONMENTS.md` | 6 | Environment files, secrets, recorder flows |
| Packaging + Polish | `PHASE_7_PACKAGING.md` | 7 | `npm` packaging, bundled runtime, PWA metadata, docs |
| Dashboard, Editor + UX Overhaul | `PHASE_8_UX_OVERHAUL.md` | 8 | Dashboard, code editor, UX consolidation |
| Improve Codegen | `FEATURE_IMPROVE_CODEGEN.md` | Feature | Recorder and generated test improvement work |
| Migration Plan | `Migration_plan.md` | Cross-phase | Architecture pivot record and migration checklist |

## Execution Order

Phases 1–7 are sequential.
**Exception:** Phase 4 can start in parallel with Phase 3 once the explorer can index and open a real test file.
Phase 8 follows after the platform is functionally complete.
`FEATURE_IMPROVE_CODEGEN.md` is a follow-on prompt for recorder and editor refinement once those capabilities exist.
