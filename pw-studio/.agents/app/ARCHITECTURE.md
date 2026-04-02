# ARCHITECTURE — PW Studio (User Reference)

This file describes how PW Studio works from a **user perspective** — what the app does at runtime, how its main areas connect, and where data lives. It is not a development guide.

## How It Works

PW Studio runs a local Node.js server on your machine. You open the browser UI at the address shown in the terminal after `npm run dev`. All test execution, file access, and secrets management happens on the server — the browser UI is the control surface.

```
Browser UI  →  PW Studio server  →  your project files / Playwright / OS keychain
```

## Main Areas

| Area | What you do here |
|---|---|
| **Projects** | Register, import, and manage Playwright projects. Projects are registered by path — files stay where they are. |
| **Dashboard** | Overview of recent runs, project health, and activity. |
| **Explorer** | Browse test files, open them in the code editor or visual block editor, and run individual tests. |
| **Runs** | View run history, test results, logs, traces, and HTML reports. Compare runs side by side. |
| **Suites** | Define and run named groups of tests with specific configurations. |
| **Recorder** | Launch Playwright codegen, capture a flow, and save it as a `.spec.ts` file. |
| **Environments** | Manage per-project environments, variables, and keychain-backed secrets. |
| **Block Library** | View, add, and manage reusable block templates for the visual editor. |
| **Plugins** | Enable and configure plugins globally and per project. |
| **Settings** | Application and project preferences. |

## Where Data Lives

| Data | Location |
|---|---|
| Project registrations and run history | PW Studio internal database (local SQLite) |
| Test files | Your project folder (unchanged — PW Studio does not move them) |
| Environment variables | Project-level config file inside the project folder |
| Secrets | OS keychain (via `keytar`) — never in the database or files |
| Block library custom templates | PW Studio app data directory |
| Plugin enablement per project | `.pw-studio/plugins/<plugin-id>.json` inside the project folder |
| Playwright config | Your project's `playwright.config.ts` — PW Studio reads it, does not modify it |

## Plugin Directories

PW Studio discovers plugins from:

1. `~/.pw-studio/plugins/` — your personal global plugins
2. Optional extra directories set in app settings
3. `pw-studio/plugins/` — plugins shipped with the app

## Starting the App

```bash
# Inside the pw-studio/ folder:
npm run dev
```

Then open the URL shown in the terminal.
