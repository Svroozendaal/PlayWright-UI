# PW Studio

PW Studio is a local web application for Playwright Test. It runs a local Node.js server, serves a browser UI on the same machine, and keeps the `.spec.ts` files as the only executable source of truth.

## What It Does

- Creates and imports Playwright projects
- Runs health checks against local Playwright setups
- Indexes files, test files, and test cases
- Edits files directly in the browser
- Runs tests, streams logs, and stores results and artefacts
- Records codegen flows and refines generated code
- Provides a visual block editor that writes normal Playwright code back to the file
- Supports a plugin-first architecture for system-specific tooling

## Plugin Model

PW Studio core stays generic. Plugins can add:

- Recorder transforms
- Visual test blocks and block templates
- Project setup hooks
- Routes and backend capabilities
- Plugin-specific integrations

The repo currently ships an optional `Mendix Portable Workflow` plugin that adds Mendix-specific recorder rewrites, helper scaffolding, and a Mendix block for `mx.clickRowCell(...)`.

## Runtime Model

- Local server: Express + TypeScript
- Browser UI: React + TypeScript
- Realtime transport: WebSocket
- Persistence: SQLite and file-backed project/plugin config
- Secrets: `keytar`
- Automation: local Playwright binary

## Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm run build
npm start
```

## Main User Flows

1. Create or import a Playwright project.
2. Check project health and configuration.
3. Open Explorer to edit files, inspect test cases, or use the block editor.
4. Run a file, folder, or test case and review logs, results, and artefacts.
5. Use Recorder to generate code, then refine or convert it through block editing or plugin transforms.
6. Manage plugins globally and enable them per project from Integrations.

## Documentation

- Architecture: `ARCHITECTURE.md`
- Contributing: `CONTRIBUTING.md`
- Full blueprint: `../.app-info/docs/PW_STUDIO_BLUEPRINT.md`

## Licence

Private - all rights reserved.
