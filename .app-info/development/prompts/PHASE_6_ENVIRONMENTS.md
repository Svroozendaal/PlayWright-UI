# PHASE 6 — Environments + Secrets + Recorder

## Goal

Add environment management, `keytar` secrets, and recorder flows to the local web runtime.

## Required Skills

- `.app-info/skills/rest-websocket-api/SKILL.md`
- `.app-info/skills/keytar-secrets/SKILL.md`
- `.app-info/skills/chokidar-watcher/SKILL.md`
- `.app-info/skills/child-process-spawn/SKILL.md`

## Deliverables

1. Environment CRUD routes and WebSocket refresh events
2. Secret set, masked-get, and delete routes
3. Recorder start, stop, status, and save routes
4. Browser-based save-path UI for generated tests

## Exit Criteria

- Environment changes refresh the UI live
- Secrets stay server-only and never reach the renderer in plaintext
- Recorder status updates stream live and saved files appear in the explorer flow
