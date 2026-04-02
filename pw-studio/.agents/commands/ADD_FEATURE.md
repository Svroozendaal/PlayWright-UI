# COMMAND: add-feature

## Purpose

Guide the full workflow for adding a new feature to PW Studio, from design to delivery.

## Entry Criteria

- Feature description is clear enough to classify the work (backend, frontend, or both).
- Acceptance criteria are defined or can be clarified.

## Workflow

1. **Classify** — use Agent Finder (`.agents/agents/AGENT_FINDER.md`) to identify which agents and skills are needed.
2. **Architect** — if the feature requires new modules, routes, database tables, or shared contracts, invoke Architect first.
   - Architect produces a file plan and interface contracts.
   - Confirm scope and non-goals before proceeding.
3. **Developer** — implement backend changes (routes, services, database).
   - Follow `.agents/skills/server-api/SKILL.md` and `.agents/skills/database/SKILL.md`.
   - Use `.agents/skills/playwright-runner/SKILL.md` if the feature touches test execution.
4. **Designer** — implement frontend changes (pages, components, hooks).
   - Follow `.agents/skills/frontend-components/SKILL.md`.
5. **Tester** — write automated tests.
   - Cover the happy path, error path, and at least one edge case.
6. **Documenter** — update `.agents/app/FEATURES.md` and any relevant module docs.
7. **Deployment** — create a PR against `main`.

## Exit Criteria

- Feature implemented, tested, and documented.
- `.agents/app/FEATURES.md` updated with the new feature and its status.
- PR created and passing.

## Skill Suggestions

Check these before starting:
- `.agents/skills/server-api/SKILL.md` — if any route is added or changed
- `.agents/skills/database/SKILL.md` — if the schema changes
- `.agents/skills/frontend-components/SKILL.md` — if the UI changes
- `.agents/skills/plugin-system/SKILL.md` — if the feature is plugin-backed
- `.agents/skills/block-editor/SKILL.md` — if the feature involves visual blocks
