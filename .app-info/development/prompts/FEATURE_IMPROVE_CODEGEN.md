# FEATURE — Improve Codegen

## Goal

Improve recorder output and generated test ergonomics on top of the web-based recorder flow.

## Dependencies

- Recorder routes and WebSocket status updates are already present
- Explorer file editing is already present

## Focus Areas

1. Refine generated test structure
2. Promote reusable variables and selectors
3. Strip redundant metadata
4. Surface post-recording suggestions in the UI

## Rules

- Use the shared API client and WebSocket hooks
- Keep generated file save flow browser-based
- Treat this as a follow-on feature, not a foundation task
