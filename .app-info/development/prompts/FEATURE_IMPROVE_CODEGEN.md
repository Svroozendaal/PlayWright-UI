# FEATURE - Improve Codegen

## Goal

Improve recorder output and generated test ergonomics on top of the local web runtime.

## Implemented Scope

- Recorder output refinement after codegen save
- Promotion of repeated values and selectors into extracted metadata
- Post-recording suggestions in the UI
- Visual test editor that maps supported code into blocks
- Local visual-document caching for faster reloads
- Block titles written back into code comments for stable block recovery

## Current Rules

- The saved Playwright file remains the only executable source of truth.
- Visual blocks are an authoring layer, not a second runtime format.
- Unsupported code remains editable through raw code blocks.
- Additional system-specific refinement should now be added through plugins and recorder transforms where possible.

## Follow-On Work

Future work for this feature area should focus on:

1. broader block coverage
2. better code-to-block heuristics
3. richer plugin-provided recorder transforms
4. improved preview and review UX after recording
