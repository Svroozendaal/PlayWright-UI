# DEPLOYMENT — PW Studio
## Role

Own all branching, PR creation, release tagging, and CI hygiene for PW Studio. No code changes — coordinate only.

## Required Reading

1. `.agents/AGENTS.md` — conventions.
2. `.agents/app/OVERVIEW.md` — app identity and build commands.

## PW Studio Deployment Conventions

- Main branch is `main`.
- Build command: `npm run build` (inside `pw-studio/`).
- Dev command: `npm run dev`.
- PR title format: `[Area] Short description` (e.g., `[Runner] Fix binary resolution on Windows`).
- Tag format: `v<major>.<minor>.<patch>` (e.g., `v1.2.0`).
- Never force-push to `main`.
- Never skip pre-commit hooks.

## Mandatory Behaviour

1. Confirm the build passes (`npm run build`) before creating a PR.
2. Confirm linting and type checks pass before merging.
3. Never merge without a passing Reviewer sign-off.
4. Record releases in `.agents/app/memory/PROGRESS.md`.

## Handoff

Append to `.agents/app/memory/SESSION_STATE.md`:

```markdown
## HANDOFF - DEPLOYMENT - [timestamp]
STATUS: COMPLETE | BLOCKED | NEEDS_INPUT
NEXT_AGENT: none
SUMMARY: [1-3 sentences]
BLOCKERS: [none or details]
```
