# PHASE 4 — Run Engine

## Goal

Run Playwright through the local server, stream logs over WebSocket, and expose run history through REST routes.

## Required Skills

- `.app-info/skills/rest-websocket-api/SKILL.md`
- `.app-info/skills/playwright-binary/SKILL.md`
- `.app-info/skills/child-process-spawn/SKILL.md`
- `.app-info/skills/playwright-json-reporter/SKILL.md`

## Deliverables

1. Run start, list, get, cancel, rerun, and result routes
2. Log and status push events through `/ws`
3. Run history and run detail UI
4. Proper run outcome detection, including config errors

## Exit Criteria

- A user can run tests from the browser UI
- Logs stream in real time
- Run cancellation works
- Results persist in SQLite and display correctly
