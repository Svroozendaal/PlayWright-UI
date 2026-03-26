# SKILL: Electron Builder Packaging

## Purpose

Rules for packaging PW Studio as a Windows installer and portable .exe.

## When to Use

- Phase 7: Final packaging
- Any time build configuration changes

## Configuration

**electron-builder.yml:**
```yaml
appId: com.pwstudio.app
productName: PW Studio
directories:
  output: dist
win:
  target:
    - target: nsis
    - target: portable
  icon: resources/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

## Native Module Handling (better-sqlite3)

**CRITICAL** — native `.node` binaries cannot load from asar:

```yaml
# In electron-builder.yml or package.json build config
asarUnpack:
  - "**/node_modules/better-sqlite3/**"
files:
  - "!**/node_modules/better-sqlite3/build/Release/obj/**"
npmRebuild: true
```

Ensure `@electron/rebuild` runs as part of the build:
```json
{
  "scripts": {
    "postinstall": "electron-rebuild",
    "build:win": "electron-builder --win",
    "build:win:portable": "electron-builder --win portable"
  }
}
```

## Build Validation Checklist

After building, verify:
1. App starts correctly after install
2. SQLite database created in `%APPDATA%/PW Studio/`
3. No hardcoded paths in the packaged app
4. better-sqlite3 native module loads without "Module did not self-register" error
5. IPC communication works (create a project, verify it persists)
6. File watcher works in packaged app
7. Playwright binary detection works from packaged context

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| "Module did not self-register" | Native module compiled against wrong Node/Electron version | Run `electron-rebuild` |
| "Cannot find module better-sqlite3" | Native binary inside asar | Add to `asarUnpack` |
| Database at wrong path | `app.getPath()` called before `app.whenReady()` | Ensure proper init order |

## Code Signing

Not required for v1 (internal use), but plan for it:
- Windows: Authenticode certificate needed
- Without signing: Windows SmartScreen shows "Unknown publisher" warning

## Rules

1. **`asarUnpack` for native modules** — mandatory for better-sqlite3.
2. **Test the packaged build** — don't assume dev mode behaviour matches production.
3. **Use electron-rebuild in postinstall** — keeps native modules aligned with Electron version.
4. **Build on the target platform** — cross-compilation of native modules is unreliable.
