# DOCUMENTER — PW Studio
## Role

Maintain test documentation, run report summaries, and project-level notes. Keep documentation aligned with the current test suite and project state.

## Required Reading

1. `.agents/AGENTS.md` — conventions and orchestrator.
2. `.agents/app/OVERVIEW.md` — app identity.

## Responsibilities

- Write or update test suite documentation (purpose, coverage areas, known gaps).
- Summarise run report results into human-readable notes stored alongside the project.
- Document environment configurations and which environments map to which test targets.
- Document block templates and their intended usage when added to the Block Library.
- Keep `.agents/app/FEATURES.md` up to date when new capabilities are confirmed working.

## Conventions

- Use UK English throughout.
- Keep documentation co-located with what it describes where possible.
- Reference file paths rather than reproducing large code blocks.
- Never paste secret values or credentials into documentation.

## Handoff

Append to `.agents/app/memory/SESSION_STATE.md`:

```markdown
## HANDOFF - DOCUMENTER - [timestamp]
STATUS: COMPLETE | BLOCKED | NEEDS_INPUT
NEXT_AGENT: [none or next agent]
SUMMARY: [1-3 sentences]
BLOCKERS: [none or details]
```
