# SKILL: OS Keychain Secrets Management

## Purpose

Rules for securely storing and retrieving secrets using the OS keychain in PW Studio.

## When to Use

- Phase 6: SecretsService implementation
- Any time secrets are read or written

## Technology Choice: Electron safeStorage vs keytar

**Evaluate both during Phase 6:**

### Option A: Electron safeStorage (recommended if sufficient)
- Built into Electron — no native module dependency
- `safeStorage.encryptString(text)` / `safeStorage.decryptString(buffer)`
- Stores encrypted data yourself (e.g. in a JSON file or SQLite)
- Available since Electron 15
- No extra packaging concerns

```typescript
import { safeStorage } from 'electron'

if (safeStorage.isEncryptionAvailable()) {
  const encrypted = safeStorage.encryptString(secretValue)
  // Store encrypted buffer in SQLite or file
  const decrypted = safeStorage.decryptString(encrypted)
}
```

### Option B: keytar
- Uses OS keychain directly (Windows Credential Manager, macOS Keychain, Linux libsecret)
- Native module — requires `@electron/rebuild` and `asarUnpack`
- May have maintenance concerns — check if still actively maintained

```typescript
import keytar from 'keytar'
await keytar.setPassword('pw-studio', accountKey, secretValue)
const secret = await keytar.getPassword('pw-studio', accountKey)
```

**Recommendation:** Try Electron `safeStorage` first. If it meets requirements (encrypt/decrypt strings, availability check), use it. Fall back to keytar only if safeStorage is insufficient.

## Account Key Format

Regardless of storage backend:
```
project/<projectId>/<envName>/<varName>
```

Example: `project/abc123/staging/LOGIN_PASSWORD`

## Secret Reference Format

In environment JSON files:
```json
{
  "secretRefs": {
    "LOGIN_PASSWORD": "pwstudio://project/abc123/staging/LOGIN_PASSWORD"
  }
}
```

Secret refs are pointers — the actual values live in the keychain/encrypted storage, never in JSON.

## Error Handling

```typescript
export class SecretsUnavailableError extends Error {
  constructor() {
    super('Keychain/encryption not available. Secrets cannot be stored.')
  }
}

// Check availability before any operation
if (!safeStorage.isEncryptionAvailable()) {
  throw new SecretsUnavailableError()
}
```

## The Cardinal Rule

**NEVER fall back to plaintext storage.** If encryption is unavailable:
- Throw `SecretsUnavailableError`
- UI shows: "Keychain not available. [Windows: Check Credential Manager settings]"
- Secrets features are disabled, not degraded

## Secret Lifecycle

1. **Set:** User enters secret in environment editor → `secrets:set` IPC → encrypt and store
2. **Get (masked):** UI requests `secrets:getMasked` → returns `"••••••"`, not the real value
3. **Get (for run):** `resolveForRun` calls `getSecret()` → decrypt and return real value
4. **Delete:** Environment deletion → delete all secrets for that environment
5. **Cleanup:** Project removal → delete all secrets for that project

## Rules

1. **Never store plaintext secrets** — encryption or nothing.
2. **Never send real secret values to renderer** — only masked values (`"••••••"`).
3. **Prefer Electron safeStorage** over keytar when possible.
4. **Clean up secrets** when environments or projects are deleted.
5. **Check availability at startup** — warn user early if encryption is not available.
