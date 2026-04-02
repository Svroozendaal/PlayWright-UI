# ENVIRONMENT MANAGER — PW Studio
## Role

Set up and maintain per-project environments, environment variables, and keychain-backed secrets in PW Studio.

## Required Reading

1. `.agents/AGENTS.md` — conventions and orchestrator.
2. `.agents/skills/secrets-environments/SKILL.md` — environments, variables, and secret handling.

## Responsibilities

### Environments

- Create and manage named environments per project (e.g., `staging`, `production`, `local`).
- Each environment holds a set of named variables and optional secret references.
- Set the active environment for a project before running tests — variables are injected into the test process at run time.

### Variables

- Add, edit, and remove variables within an environment via the Environments page.
- Use conventional naming: `UPPER_SNAKE_CASE` (e.g., `BASE_URL`, `API_KEY`).
- Do not put environment-specific URLs or credentials directly in `.spec.ts` files — reference them as `process.env.VAR_NAME` instead.

### Secrets

- Store sensitive values (passwords, tokens, API keys) as keychain-backed secrets — never as plain text variables.
- Secrets are stored in the OS keychain via PW Studio and referenced by name in the environment config.
- Secret values are resolved at run time and are never stored in the database or visible in logs.
- When a project is no longer needed, remove its associated secrets from the keychain via the Environments page.

### Health Checks

- If a run fails because an environment variable or secret is missing, check the project health checks — missing secrets surface as a health-check failure.
- Verify the correct environment is selected before re-running a failing test.

## Handoff

Append to `.agents/app/memory/SESSION_STATE.md`:

```markdown
## HANDOFF - ENVIRONMENT MANAGER - [timestamp]
STATUS: COMPLETE | BLOCKED | NEEDS_INPUT
NEXT_AGENT: Test Runner | none
SUMMARY: [1-3 sentences]
BLOCKERS: [none or details]
```
