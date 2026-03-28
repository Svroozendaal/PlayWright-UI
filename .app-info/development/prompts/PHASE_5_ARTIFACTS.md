# PHASE 5 — Artifacts

## Goal

Persist artifact policy, expose artifact routes, and support failed-test reruns in the web architecture.

## Required Skills

- `.app-info/skills/rest-websocket-api/SKILL.md`
- `.app-info/skills/artifact-policy-resolution/SKILL.md`
- `.app-info/skills/path-safety/SKILL.md`

## Deliverables

1. Artifact policy routes
2. Artifact open, report open, and trace show flows using OS shell commands
3. Rerun failed route and UI
4. Artifact tab in run detail

## Rules

- Keep path handling cross-platform
- Never expose raw shell commands to the renderer
- Validate all artifact paths before opening them
