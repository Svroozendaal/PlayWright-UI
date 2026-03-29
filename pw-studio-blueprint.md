# PW STUDIO BLUEPRINT

This file mirrors `.app-info/docs/PW_STUDIO_BLUEPRINT.md` as a repo-root architecture snapshot.

## Product Summary

PW Studio is a local Playwright orchestration platform with:

- Express server
- React browser UI
- REST API + WebSocket events
- plugin-first extension model
- visual block authoring that writes back to normal Playwright code

## Core Principles

- Keep the `.spec.ts` file as the only runnable source of truth.
- Keep core PW Studio generic.
- Push system-specific behaviour into plugins.
- Keep plugin installation app-wide and enablement per project.

## Shipped Extension Example

The repo currently includes a Mendix workflow plugin that proves the generic runtime:

- recorder transform
- helper scaffolding
- project map file
- Mendix-specific visual block

For the full blueprint, read `.app-info/docs/PW_STUDIO_BLUEPRINT.md`.
