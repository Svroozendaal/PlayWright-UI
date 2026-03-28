# SKILL: Playwright Binary Detection and Spawn

## Purpose

Rules for detecting, spawning, and interacting with the local Playwright binary from PW Studio's local server.

## When to Use

- Binary detection
- Test execution
- Recorder/codegen

## Rules

1. Always use the local binary in `node_modules/.bin/`.
2. On Windows, use `playwright.cmd`.
3. Use `path.join()` for binary path construction.
4. Prefer `shell: false` and fall back to `shell: true` only if `.cmd` execution requires it.
5. Check the binary exists before spawning and return a clear error if missing.
6. Use `taskkill /T /F` on Windows when killing Playwright process trees.
