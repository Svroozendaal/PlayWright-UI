# COMMAND: fix-bug

## Purpose

Guide the root-cause analysis and fix workflow for a defect in PW Studio.

## Entry Criteria

- A defect description with reproduction steps (or enough context to reproduce).
- The affected area is known or can be narrowed down.

## Workflow

1. **Debugger** — perform root-cause analysis.
   - Reproduce the defect.
   - Identify the root cause with a specific file and line if possible.
   - Produce a fix plan with specific file changes.
   - Record in `.agents/app/memory/SESSION_STATE.md`.
2. **Developer** — implement the fix based on the Debugger's plan.
   - Follow the relevant skill for the affected area.
   - Do not expand scope — fix only what was diagnosed.
3. **Tester** — write a regression test that would have caught the bug.
4. **Deployment** — create a PR against `main`.

## Exit Criteria

- Root cause identified and documented.
- Fix implemented and regression test in place.
- PR created and passing.

## Skill Suggestions

- `.agents/skills/server-api/SKILL.md` — if the bug is in a route or envelope handling
- `.agents/skills/database/SKILL.md` — if the bug is in schema or query logic
- `.agents/skills/playwright-runner/SKILL.md` — if the bug is in test execution or binary resolution
- `.agents/skills/plugin-system/SKILL.md` — if the bug is in plugin loading or extension point handling
