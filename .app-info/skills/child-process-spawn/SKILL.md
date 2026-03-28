# SKILL: Child Process Spawn on Windows

## Purpose

Rules for spawning child processes from PW Studio's local server, with focus on Windows-specific behaviour.

## Method Selection

| Method | Use when |
|---|---|
| `spawn` | Long-running processes with streaming output |
| `execFileSync` | Quick commands where output is needed |
| `exec` | Shell commands such as opening an artifact in the OS |

## Rules

1. Use `spawn` for runs and codegen.
2. Use `execFileSync` for quick checks such as version detection.
3. Default to `shell: false`.
4. When `shell: true` is required, quote paths that may contain spaces.
5. Always set `cwd`.
6. Use `taskkill /T /F` on Windows to kill Playwright process trees.
7. Decode stdout and stderr as UTF-8.
