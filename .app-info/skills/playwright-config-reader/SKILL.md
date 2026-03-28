# SKILL: Playwright Config Reader

## Purpose

Rules for dynamically reading `playwright.config.*` to extract `testDir`, `projects`, and `outputDir` without hardcoding assumptions.

## The Cardinal Rule

**Never hardcode `tests/` as `testDir`.** Always use `configSummary.testDir`.

## Extraction Pattern

- Spawn the current Node runtime with an inline module script
- Dynamically import the project's Playwright config
- Extract the fields needed by health, explorer, runs, and recorder
- Fall back gracefully if config parsing fails

## Rules

1. Cache extraction results because the read is process-based.
2. Invalidate the cache when `playwright.config.*` changes.
3. Fall back to `path.join(rootPath, 'tests')` only when config reading fails.
4. Use the shared config summary everywhere that needs `testDir` or `projects`.
