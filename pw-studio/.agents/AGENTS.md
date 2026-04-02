# AGENTS — PW Studio
## Orchestrator and Starting Point

This file is the primary entry point for any AI assistant working inside the `pw-studio/` folder as a standalone context.

Read this file first. Then read `.agents/app/OVERVIEW.md` to understand what the app does, and `.agents/app/ARCHITECTURE.md` to understand how it is built.

---

## What Is PW Studio

PW Studio is a local web application for Playwright Test orchestration. It provides:

- Project creation, import, and health checks
- A file explorer with code editing and a visual block editor
- Test execution, run history, logs, and artefact access
- Recorder capture and code refinement
- Environment and secrets management
- A global block library and plugin system

The app runs entirely on the developer's machine. A Node.js Express server hosts a React SPA, exposes REST and WebSocket APIs, and manages SQLite, the OS keychain, filesystem watching, and local Playwright execution.

---

## First Step Rule

Before acting on any prompt:

1. Read this file (`AGENTS.md`).
2. Read `.agents/app/OVERVIEW.md` — app identity, core principles, and main areas.
3. Read `.agents/app/ARCHITECTURE.md` — stack, transport, runtime, and folder map.
4. Ask clarifying questions before changing any files.
5. Confirm scope and non-goals before starting.

---

## Agent Selection Logic

Classify the task and route to the correct agent. Evaluate rules in order:

| # | Task type | Agent |
|---|---|---|
| 1 | Small, single-file, unambiguous change with no new contracts | **Light** |
| 2 | Architectural decision, new module, or new data contract | **Architect** |
| 3 | Backend logic, API, data storage, business rules | **Developer** |
| 4 | Frontend/UI — layout, components, styling, responsive behaviour | **Designer** |
| 5 | Bug or defect requiring root-cause analysis | **Debugger** |
| 6 | Test creation, validation, or regression check | **Tester** |
| 7 | Documentation creation or update | **Documenter** |
| 8 | Branch, PR, release, or deployment task | **Deployment** |
| 9 | Unsure which agent or skill applies | **Agent Finder** |

**Multi-agent tasks:** Sequence agents — for example: Architect → Developer → Tester → Deployment.

**Skills:** Before any non-trivial task, consult `.agents/skills/OVERVIEW.md` for available skills.

---

## Agent Roster

| Agent | File | Responsibility |
|---|---|---|
| Architect | `.agents/agents/ARCHITECT.md` | Design, scope, contracts, decisions |
| Developer | `.agents/agents/DEVELOPER.md` | Backend development, security, delivery |
| Designer | `.agents/agents/DESIGNER.md` | Frontend/UI, components, styling |
| Tester | `.agents/agents/TESTER.md` | Validation, edge cases, regressions |
| Debugger | `.agents/agents/DEBUGGER.md` | Root-cause analysis and fixes |
| Documenter | `.agents/agents/DOCUMENTER.md` | Documentation quality and upkeep |
| Deployment | `.agents/agents/DEPLOYMENT.md` | Branching, PRs, CI/CD, release hygiene |
| Light | `.agents/agents/LIGHT.md` | Fast-path for small, clearly-scoped tasks |
| Agent Finder | `.agents/agents/AGENT_FINDER.md` | Route queries to the correct agent or skill |

---

## Skills Overview

| Skill | File | Domain |
|---|---|---|
| Server API | `.agents/skills/server-api/SKILL.md` | Express routes, envelope pattern, WebSocket events |
| Frontend Components | `.agents/skills/frontend-components/SKILL.md` | React pages, components, and routing |
| Database | `.agents/skills/database/SKILL.md` | SQLite schema, migrations, and query patterns |
| Playwright Runner | `.agents/skills/playwright-runner/SKILL.md` | Local binary execution, config, and result parsing |
| Plugin System | `.agents/skills/plugin-system/SKILL.md` | Plugin discovery, registration, and extension points |
| Block Editor | `.agents/skills/block-editor/SKILL.md` | Visual block authoring, templates, and code round-trip |
| Secrets and Environments | `.agents/skills/secrets-environments/SKILL.md` | keytar, environment variables, and project config |

---

## Core Conventions

- Use UK English in all documentation.
- Use the local Playwright binary — never `npx playwright`.
- `.spec.ts` files are the only executable source of truth.
- All shared type contracts live in `src/shared/types/`.
- API responses use the `ApiEnvelope<T>` pattern.
- Route system-specific behaviour through plugins.
- Keep secrets in the OS keychain only.
- `npm run dev` for local development; `npm run build` for production.

---

## Directory Map (pw-studio/)

| Path | Purpose |
|---|---|
| `src/server/` | Express server, routes, services, plugin runtime |
| `src/renderer/` | React SPA — pages, components, hooks, styles |
| `src/shared/` | Shared types, contracts, constants |
| `plugins/` | Shipped local plugins |
| `resources/` | Packaged static assets |
| `.agents/` | This AI framework (standalone context) |

---

## Memory and Decisions

Write session decisions, progress, and handoffs to `.agents/app/memory/` (create the folder if it does not exist):

- `SESSION_STATE.md` — current session context and handoff blocks
- `DECISIONS_LOG.md` — architectural decisions and rationale
- `PROGRESS.md` — implementation progress per task

---

## Required Handoff Block

Every agent hand-off must append this block to `.agents/app/memory/SESSION_STATE.md`:

```markdown
## HANDOFF - [Agent] - [timestamp]
STATUS: COMPLETE | BLOCKED | NEEDS_INPUT
NEXT_AGENT: [Agent or none]
SUMMARY: [1-3 sentences]
BLOCKERS: [none or details]
```
