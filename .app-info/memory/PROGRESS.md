# PROGRESS

## TEMPLATE

```markdown
## PROGRESS_ENTRY - [timestamp]
SCOPE: [...]
FILES_CHANGED: [...]
VALIDATION: [...]
NOTES: [...]
```

## LIVE_LOG

## PROGRESS_ENTRY - 2026-03-28
SCOPE: Documentation-first rewrite for the Electron-to-web migration.
FILES_CHANGED: `.app-info/app/*`, `.app-info/config/OVERVIEW.md`, `.app-info/docs/PW_STUDIO_BLUEPRINT.md`, `.app-info/features/FEATURES.md`, `.app-info/skills/*`, `.app-info/development/OVERVIEW.md`, `.app-info/development/prompts/*`, `.app-info/agents/*`, `CLAUDE.md`, `pw-studio/README.md`, `pw-studio/ARCHITECTURE.md`, `pw-studio/CONTRIBUTING.md`, `pw-studio-blueprint.md`.
VALIDATION: Pending stale-reference scan after documentation rewrite.
NOTES: The repo narrative now targets a local Express + React + WebSocket architecture with `npm` plus bundled-runtime packaging.

## PROGRESS_ENTRY - 2026-03-28
SCOPE: Atomic runtime migration inside `pw-studio` from Electron to Express + React SPA + WebSocket.
FILES_CHANGED: `pw-studio/src/server/**/*`, `pw-studio/src/shared/types/ipc.ts`, `pw-studio/src/renderer/src/**/*`, `pw-studio/src/renderer/public/**/*`, `pw-studio/package.json`, `pw-studio/package-lock.json`, `pw-studio/vite.config.ts`, `pw-studio/tsconfig*.json`, `pw-studio/scripts/bundle-runtime.mjs`.
VALIDATION: `npm install`, `npm rebuild better-sqlite3 keytar`, `npm run typecheck`, `npm run build`, built-server HTTP smoke test against `/api/settings/app-info` and `/api/openapi.json`, bundled-runtime smoke test from `release/pw-studio-win32-x64`.
NOTES: The app now serves the SPA and API from the Node server, loads plugins from `~/.pw-studio/plugins`, exposes OpenAPI metadata, ships a manifest for installability, and no longer depends on Electron/preload files. The runtime smoke test initially failed because `better-sqlite3` was still built against Electron's ABI; rebuilding the native modules resolved it.

## PROGRESS_ENTRY - 2026-03-28
SCOPE: Recorder follow-up fixes and broader post-migration smoke validation.
FILES_CHANGED: `pw-studio/src/renderer/src/pages/RecorderPage.tsx`, `pw-studio/src/renderer/src/components/RunDialog.tsx`, `pw-studio/src/renderer/src/pages/SettingsPage.tsx`, `pw-studio/src/renderer/src/App.css`, `pw-studio/src/server/routes/health.ts`, `pw-studio/src/server/utils/playwrightConfigReader.ts`, `pw-studio/src/shared/types/ipc.ts`.
VALIDATION: `npm run typecheck`, `npm run build`, live API smoke tests against `/api/projects`, `/api/projects/:id/config`, `/api/projects/:id/explorer/tree`, headless Playwright UI smoke across the main routes, recorder-page assertion that the default output folder resolves to the sample project's `tests/` directory, and `npx playwright test tests/smoke/homepage.spec.ts --reporter=line` in the sample project.
NOTES: The recorder now defaults to the resolved Playwright `testDir` so generated recordings land in the indexed test tree. During validation an additional config-reader defect was found and fixed: `.ts` configs were incorrectly reported as dynamically loaded defaults, which hid configured browser project names from the UI.

## PROGRESS_ENTRY - 2026-03-29
SCOPE: Collapsible project navigation for the PW Studio web app.
FILES_CHANGED: `pw-studio/src/renderer/src/components/Sidebar.tsx`, `pw-studio/src/renderer/src/App.css`, `.app-info/memory/SESSION_STATE.md`, `.app-info/memory/DECISIONS_LOG.md`, `.app-info/memory/PROGRESS.md`.
VALIDATION: `npm run typecheck`, `npm run build`.
NOTES: The project sidebar now supports a persistent icon-only collapsed state, keeps settings and back navigation usable in the compact rail, and preserves the active run indicator in both layouts.

## PROGRESS_ENTRY - 2026-03-29
SCOPE: Replace the custom folder picker with the operating system native directory chooser.
FILES_CHANGED: `pw-studio/src/server/routes/directories.ts`, `pw-studio/src/shared/types/ipc.ts`, `pw-studio/src/renderer/src/api/client.ts`, `pw-studio/src/renderer/src/components/CreateProjectWizard.tsx`, `pw-studio/src/renderer/src/pages/ProjectsPage.tsx`, `pw-studio/src/renderer/src/pages/RecorderPage.tsx`, `.app-info/memory/SESSION_STATE.md`, `.app-info/memory/DECISIONS_LOG.md`, `.app-info/memory/PROGRESS.md`.
VALIDATION: `npm run typecheck`, `npm run build`.
NOTES: Project creation, project import, and recorder output selection now open the native system folder chooser. The backend handles the dialog so the renderer still receives an absolute path that the existing project and recorder flows can use unchanged.

## PROGRESS_ENTRY - 2026-03-29
SCOPE: Plugin-first platform completion, shipped Mendix plugin, documentation refresh, and building-block skill creation.
FILES_CHANGED: `pw-studio/plugins/**/*`, `pw-studio/src/server/plugins/**/*`, `pw-studio/src/server/routes/plugins.ts`, `pw-studio/src/server/services/*`, `pw-studio/src/renderer/src/pages/PluginManagerPage.tsx`, `pw-studio/src/renderer/src/pages/ProjectIntegrationsPage.tsx`, `pw-studio/src/renderer/src/components/TestBlockEditor.tsx`, `pw-studio/README.md`, `pw-studio/ARCHITECTURE.md`, `pw-studio/CONTRIBUTING.md`, `CLAUDE.md`, `pw-studio-blueprint.md`, `.app-info/docs/*`, `.app-info/app/*`, `.app-info/config/OVERVIEW.md`, `.app-info/features/*`, `.app-info/skills/OVERVIEW.md`, `.app-info/development/OVERVIEW.md`, `.app-info/development/prompts/OVERVIEW.md`, `.app-info/development/prompts/FEATURE_IMPROVE_CODEGEN.md`, `.app-info/skills/create-building-blocks/**/*`, `.app-info/memory/*`.
VALIDATION: `npm run typecheck`, `npm run build`, runtime plugin load smoke, Mendix plugin enablement smoke, block-library availability smoke, test-editor sync smoke for `mx.clickRowCell(...)`, `quick_validate.py` for the new skill.
NOTES: The repo now documents the plugin-first runtime as the real application shape, ships the Mendix plugin as an optional local plugin, and includes a dedicated app-specific skill for adding future visual blocks safely.
