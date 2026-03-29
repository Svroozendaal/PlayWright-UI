# APP OVERVIEW - PW Studio

## Name

PW Studio

## Description

PW Studio is a local web application for Playwright Test. It provides project management, health checks, file editing, test execution, artefact access, recorder flows, visual block authoring, and a plugin-first extension model while keeping Playwright code files as the real source of truth.

## Core Principles

1. Registry, not project relocation - project folders stay where they already live.
2. Local binary execution - use the local Playwright binary, not `npx`.
3. Graceful degradation - unsupported visual-editor statements remain editable as raw code.
4. Plugin-first extension - system-specific behaviour belongs in plugins, not in core.
5. File-backed project integration state - plugin enablement and reusable block availability are stored in project files.
6. Local-only runtime - no cloud-hosted or remote execution model in v1.

## Main User Areas

- Projects
- Dashboard
- Explorer
- Runs
- Recorder
- Settings
- Integrations
- Block Library

## Non-Goals

- Not a replacement for the Playwright CLI
- Not a cloud-hosted service
- No plaintext secret storage
- No separate executable block runtime
- No multi-user or remote access model in v1

## Target Users

Developers and QA engineers who use Playwright Test and want a local orchestration UI, including visual authoring and project-specific plugin tooling.
