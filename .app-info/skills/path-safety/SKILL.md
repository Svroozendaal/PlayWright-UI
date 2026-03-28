# SKILL: Path Safety

## Purpose

Rules for safe cross-platform path handling across the PW Studio codebase.

## Path Construction

- Use `path.join()` or `path.resolve()`
- Never concatenate paths with `+` or template literals
- Never hardcode system directories

## Standard User Paths

Use the local server path helpers to resolve:

- user data directory
- home directory
- Documents directory
- temporary directory

## Rules

1. Always use platform-aware path helpers.
2. Test with spaces, Unicode, and non-system drives.
3. Never hardcode `tests/`; use `configSummary.testDir`.
4. Quote paths when shell execution is required.
