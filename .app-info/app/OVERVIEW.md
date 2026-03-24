# APP OVERVIEW — PW Studio

## Name

PW Studio

## Description

PW Studio v1 is a local Electron desktop app that wraps Playwright Test with a GUI. It is an orchestration layer around Playwright — not an alternative to it.

## Core Principles

1. **Registry, not central storage** — The app manages paths and metadata. Project folders are never moved. Imported projects stay at their existing location.
2. **CLI-first via local binary** — Always use `node_modules/.bin/playwright` (or `.cmd` on Windows). Never use `npx playwright`. `--reporter=json` is the fixed parseable output in v1.
3. **Graceful degradation** — Filesystem tree always works. Test file detection works mostly. Testcase extraction may fail without breaking the explorer.
4. **File watching as foundation** — chokidar watchers are core infrastructure. Watcher reports events, indexer does parsing. Changes in `environments/` and `playwright.config.*` also trigger cache invalidation.
5. **Security via OS secure storage** — Secrets via keytar (OS keychain). JSON files only contain secretRefs. No custom encryption. No plaintext fallback.

## Non-Goals

- Not a replacement for Playwright CLI
- Not a cloud/SaaS service
- Not cross-platform in v1 (Windows only)
- No custom encryption or plaintext secret storage

## Target Users

Developers and QA engineers who use Playwright Test and want a visual orchestration layer for managing projects, running tests, and viewing results.
