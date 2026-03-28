# PHASE 3 — Explorer

## Goal

Build the explorer as a browser UI backed by watcher-driven server routes and WebSocket refresh events.

## Required Skills

- `.app-info/skills/rest-websocket-api/SKILL.md`
- `.app-info/skills/chokidar-watcher/SKILL.md`
- `.app-info/skills/playwright-config-reader/SKILL.md`
- `.app-info/skills/react-tree-component/SKILL.md`

## Deliverables

1. File watch service using server broadcast callbacks
2. Project index rebuild and invalidation
3. Explorer tree routes
4. File read, write, and create routes
5. Explorer page updates via fetch client and socket hook

## Exit Criteria

- Explorer shows folders, test files, and extracted test cases
- External file changes trigger refresh without a full page reload
- File editing works through API routes
