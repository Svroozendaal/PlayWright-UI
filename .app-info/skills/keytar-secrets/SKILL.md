# SKILL: OS Keychain Secrets Management

## Purpose

Rules for securely storing and retrieving secrets using the OS keychain in PW Studio.

## Storage Choice

PW Studio uses `keytar` directly in the local server runtime.

Reasons:

- Uses the platform keychain or credential store directly
- Keeps secrets out of the browser and out of plaintext files
- Works consistently with the local server architecture

## Cardinal Rules

1. Never store plaintext secrets.
2. Never send real secret values to the renderer.
3. Keep the account key format stable: `project/<projectId>/<envName>/<varName>`.
4. Clean up secrets when environments or projects are deleted.
5. If `keytar` is unavailable, fail clearly and disable secrets features rather than degrading to insecure storage.
