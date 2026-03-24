# CLAUDE.md — PW Studio

## First Step Rule

Before any prompt is executed, always follow this order:

1. Read `.agents/AGENTS.md` — primary governance and agent routing.
2. Read `.agents/FRAMEWORK.md` — dual-folder structure and extension model.
3. Read `.app-info/ROUTING.md` — navigate app-specific data.
4. Ask clarifying workflow questions first.
5. Confirm assumptions before changing files.

## Agent Framework

This project uses the `.agents/` multi-agent framework. All work must be routed through the appropriate agent as defined in `.agents/AGENTS.md`.

- **Generic, reusable framework:** `.agents/`
- **App-specific data:** `.app-info/`

Never modify `.agents/` for app-specific purposes. Use `.app-info/agents/` for extensions.

## Project Identity

- **App:** PW Studio v1
- **Purpose:** Local Electron desktop app that wraps Playwright Test with a GUI — an orchestration layer, not a replacement.
- **Blueprint:** `.app-info/docs/PW_STUDIO_BLUEPRINT.md`

## Core Conventions

- Use UK English in all documentation.
- Use the local Playwright binary (`node_modules/.bin/playwright`), never `npx`.
- `--reporter=json` is the standard parseable output.
- All secrets via OS keychain (keytar) — no plaintext fallback.
- IPC uses the envelope pattern defined in `src/shared/types/ipc.ts`.

## Stack

Electron | React + TypeScript | Node.js + TypeScript | SQLite (better-sqlite3) | chokidar | keytar | electron-builder
