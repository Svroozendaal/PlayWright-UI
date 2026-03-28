# APP OVERVIEW — PW Studio

## Name

PW Studio

## Description

PW Studio v1 is a local web application that wraps Playwright Test with a GUI. It runs a local Node.js server and opens a browser UI on the developer's machine. It is an orchestration layer around Playwright, not an alternative to it.

## Core Principles

1. **Registry, not central storage** — The app manages paths and metadata. Project folders are never moved. Imported projects stay at their existing location.
2. **CLI-first via local binary** — Always use `node_modules/.bin/playwright` (or `.cmd` on Windows). Never use `npx playwright`. `--reporter=json` remains the fixed parseable output in v1.
3. **Graceful degradation** — Filesystem tree always works. Test file detection works mostly. Test case extraction may fail without breaking the explorer.
4. **File watching as foundation** — chokidar watchers are core infrastructure. Watcher reports events, indexer does parsing. Changes in `environments/` and `playwright.config.*` also trigger cache invalidation.
5. **Security via OS secure storage** — Secrets use `keytar` and the OS keychain. JSON files only contain `secretRefs`. No custom encryption. No plaintext fallback.
6. **Local-only runtime** — The HTTP API and WebSocket server bind to localhost. PW Studio is not a cloud-hosted service.

## Non-Goals

- Not a replacement for Playwright CLI
- Not a cloud-hosted service
- No custom encryption or plaintext secret storage
- No multi-user or remote access model in v1

## Target Users

Developers and QA engineers who use Playwright Test and want a visual orchestration layer for managing projects, running tests, editing files, and reviewing results.
