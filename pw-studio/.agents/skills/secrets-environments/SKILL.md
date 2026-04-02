# SKILL: secrets-environments

## Purpose

Guide the setup and use of per-project environments, variables, and keychain-backed secrets in PW Studio.

## When to Use

- Creating or switching project environments (e.g., `staging`, `production`, `local`).
- Adding, editing, or removing environment variables.
- Storing or referencing a sensitive value (password, token, API key) as a secret.
- Diagnosing a run failure caused by a missing variable or secret.

## Procedure

### Creating an Environment

1. Open the Environments page for the project.
2. Create a named environment (e.g., `staging`).
3. Add variables to the environment — each variable has a name and a value.
4. Optionally reference a keychain secret as the value for sensitive variables.

### Variable Conventions

- Name variables in `UPPER_SNAKE_CASE` (e.g., `BASE_URL`, `API_KEY`, `TEST_USER_PASSWORD`).
- Reference variables in test files as `process.env.VAR_NAME` — never hardcode values.
- Keep environment-specific URLs, user credentials, and configuration in variables — not in the test code.

### Storing Secrets

- Store sensitive values (passwords, tokens, API keys) as keychain-backed secrets — not as plain text variables.
- Add a secret from the Environments page — PW Studio stores it in the OS keychain.
- Reference a secret by name in an environment variable — the value is resolved at run time and never visible in the UI or logs.
- Secrets are scoped per project. When a project is removed, delete associated secrets via the Environments page.

### Selecting an Environment for a Run

- Before running tests, ensure the correct environment is selected for the project.
- The selected environment's variables are injected into the Playwright child process at run time.
- The variable resolution order is: selected environment overrides → project defaults → system environment.

### Diagnosing Missing Variables

1. Check the project health checks — missing keychain secrets surface as a health-check failure before a run starts.
2. If a run fails with `process.env.VAR_NAME is undefined`, confirm the variable exists in the selected environment.
3. Confirm the correct environment is selected for the project.

## Notes

- Secret values are never stored in the PW Studio database or shown in the UI after saving.
- If the OS keychain is unavailable (e.g., a headless CI environment), secrets will not resolve — the health check will flag this.
