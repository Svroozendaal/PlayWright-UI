# AGENTS — PW Studio
## Orchestrator and Starting Point

This file is the primary entry point for any AI assistant working inside the `pw-studio/` folder.

PW Studio is a local UI for Playwright Test. This agent framework covers **using** PW Studio — writing and running tests, managing projects, working with environments, the recorder, the visual block editor, and plugins. It does not cover developing PW Studio itself.

---

## What Is PW Studio

PW Studio is a local web application for Playwright Test orchestration. It provides:

- Project creation, import, and health checks
- A file explorer with code editing and a visual block editor
- Test execution, run history, logs, and artefact access
- Recorder capture and code refinement
- Environment and secrets management
- A global block library and plugin system

The app runs entirely on the developer's machine. Start it with `npm run dev` inside the `pw-studio/` folder, then open the browser UI.

---

## First Step Rule

Before acting on any prompt:

1. Read this file (`AGENTS.md`).
2. Read `.agents/app/OVERVIEW.md` — app identity and main areas.
3. Ask clarifying questions before changing any files.
4. Confirm scope before starting.

---

## Agent Selection Logic

Classify the task and route to the correct agent:

| # | Task type | Agent |
|---|---|---|
| 1 | Writing, editing, or organising Playwright test files | **Test Author** |
| 2 | Running tests, interpreting results, triaging failures | **Test Runner** |
| 3 | Recording a new test flow with the PW Studio recorder | **Recorder** |
| 4 | Setting up or modifying project environments and secrets | **Environment Manager** |
| 5 | Adding or configuring a block template in the block library | **Block Author** |
| 6 | Enabling, configuring, or using a plugin | **Plugin Manager** |
| 7 | Updating test documentation or run reports | **Documenter** |
| 8 | Small, single-file, clearly-scoped change | **Light** |
| 9 | Unsure which agent applies | **Agent Finder** |

---

## Agent Roster

| Agent | File | Responsibility |
|---|---|---|
| Test Author | `.agents/agents/TEST_AUTHOR.md` | Write, edit, and organise `.spec.ts` test files |
| Test Runner | `.agents/agents/TEST_RUNNER.md` | Run tests, interpret results, triage failures |
| Recorder | `.agents/agents/RECORDER.md` | Record new test flows and refine generated code |
| Environment Manager | `.agents/agents/ENVIRONMENT_MANAGER.md` | Manage environments, variables, and secrets |
| Block Author | `.agents/agents/BLOCK_AUTHOR.md` | Add and configure visual block templates |
| Plugin Manager | `.agents/agents/PLUGIN_MANAGER.md` | Enable, configure, and use plugins |
| Documenter | `.agents/agents/DOCUMENTER.md` | Test documentation and run report summaries |
| Light | `.agents/agents/LIGHT.md` | Fast-path for small, clearly-scoped tasks |
| Agent Finder | `.agents/agents/AGENT_FINDER.md` | Route queries to the correct agent or skill |

---

## Skills Overview

| Skill | File | Domain |
|---|---|---|
| Playwright Runner | `.agents/skills/playwright-runner/SKILL.md` | Running tests, configs, and result interpretation |
| Block Editor | `.agents/skills/block-editor/SKILL.md` | Visual block authoring and templates |
| Plugin System | `.agents/skills/plugin-system/SKILL.md` | Plugin enablement and extension points |
| Secrets and Environments | `.agents/skills/secrets-environments/SKILL.md` | Environments, variables, and keychain secrets |
| Expand Test | `.agents/skills/expand-test/SKILL.md` | Generate thorough test coverage from a seed test as a precondition |

---

## Core Conventions

- Use UK English in all documentation.
- `.spec.ts` files are the only executable source of truth — the visual block editor writes back to them.
- Use `npm run dev` to start PW Studio locally.
- Never use `npx playwright` directly — always run tests through PW Studio or the project's local binary.
- Keep secrets in the OS keychain only — never in plain text files.

---

## Memory

Write session decisions and progress to `.agents/app/memory/` (create files as needed):

- `SESSION_STATE.md` — current context and handoff blocks
- `PROGRESS.md` — task progress

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
