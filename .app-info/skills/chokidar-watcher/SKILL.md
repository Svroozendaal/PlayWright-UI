# SKILL: chokidar File Watching

## Purpose

Rules for file system watching using chokidar in PW Studio's local server.

## Rules

1. Only watch paths that exist.
2. Debounce events at 300ms.
3. Watchers emit filesystem events only; indexers and other services do the heavier work.
4. Restart the watcher if `playwright.config.*` changes and the watch targets need recalculating.
5. Broadcast refresh events through the shared `broadcast()` function rather than a window object.
