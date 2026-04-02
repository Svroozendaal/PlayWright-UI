# SKILL: secrets-environments

## Purpose

Guide the correct handling of secrets via `keytar` and per-project environment variable management in PW Studio.

## When to Use

- Adding, reading, or deleting a secret (API key, password, token).
- Working with per-project environment configuration or variable overrides.
- Passing environment variables to a Playwright test run.

## Procedure

### Secrets (keytar)

1. All secrets are stored in the OS keychain via `keytar` — never in SQLite, flat files, or memory beyond the request scope.
2. Use the secrets service in `src/server/services/` for all keytar operations — do not call `keytar` directly from a route handler.
3. Secret keys follow the format: `pw-studio:<project-id>:<secret-name>`.
4. Never return a secret's value in an API response unless the endpoint is explicitly designed for secret retrieval and is documented as such.
5. Never log secret values — log only the secret key (name), not the value.
6. When a project is deleted, prompt to clean up associated secrets from the keychain.

### Environment Variables

1. Per-project environments are stored in the project-level config (not in the PW Studio SQLite database).
2. An environment can define named variables with values, and optionally reference a secret by key for sensitive values.
3. When running tests, merge the selected environment's variables into the child process environment — never into the Playwright config file.
4. Variable resolution order: selected environment overrides → project defaults → system environment.
5. Sensitive variables (backed by keytar secrets) are resolved at spawn time and must not appear in logs or stored run metadata.

### Validation

- Validate that referenced secret keys exist in the keychain before a run starts — surface the missing key as a health-check failure.
- Validate variable names against the pattern `[A-Z_][A-Z0-9_]*` (conventional env var format).

## Output / Expected Result

- Secrets stored and retrieved via `keytar` through the secrets service.
- Environment variables merged into the child process at spawn time — not persisted in logs.
- Missing secrets surfaced as a health-check failure before a run starts.

## Notes

- `keytar` may not be available in all environments (e.g., CI without a keychain). Handle the unavailable case gracefully and surface it in the health check.
- Do not store the keytar service account name as a hardcoded string in multiple places — use a single constant.
