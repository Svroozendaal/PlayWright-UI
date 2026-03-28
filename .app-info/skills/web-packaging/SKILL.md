# SKILL: Web Packaging

## Purpose

Rules for shipping PW Studio as a local web application with a bundled runtime.

## When to Use

- Phase 7: Packaging and release preparation
- Any time build output or startup packaging changes

## Packaging Targets

Primary targets:

- `npm install && npm start`
- Bundled local runtime archive containing built assets, server output, and the required Node runtime entry point

## Build Validation Checklist

After packaging, verify:

1. The local server starts cleanly
2. The SPA is served by the server
3. SQLite database is created in the correct user-data location
4. `better-sqlite3` loads correctly
5. `keytar` loads correctly
6. API routes and WebSocket events work in the packaged output

## Rules

1. Do not rely on desktop-shell-specific packaging tools.
2. Keep packaging cross-platform where native dependencies allow.
3. Validate bundled output on each supported platform.
4. Include PWA metadata but do not introduce offline-first service worker behaviour in v1.
