# PW Studio

PW Studio is a local Electron desktop application that wraps Playwright Test with a graphical user interface. It is an orchestration layer — not a replacement for Playwright.

## Requirements

- **Node.js** >= 18
- **npm** >= 8
- **Playwright** >= 1.40 (installed per project)
- **Windows** 10 or later

## Installation

### Windows Installer

1. Download the latest `.exe` from the Releases page.
2. Run the installer and follow the prompts.
3. Launch PW Studio from the Start Menu.

### Portable

Download the portable `.exe` — no installation required. Run it directly.

## First Steps

1. **Create a project** — click "New Project", choose a name and folder, select browsers, and PW Studio will scaffold a Playwright project with `npm install`.
2. **Import an existing project** — click "Import Project" and select a folder that already contains a `playwright.config.ts`.
3. **Check health** — the Health Panel shows whether Node, npm, Playwright, and browsers are correctly set up.
4. **Run tests** — open the Explorer, right-click a file or folder, and choose "Run".
5. **View results** — navigate to the Runs page to see history, logs, and test results.

## Development

```bash
# Install dependencies (rebuilds native modules automatically)
npm install

# Start in development mode
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build

# Package for Windows (installer + portable)
npm run build:win
```

## Screenshots

| Projects | Explorer | Run Detail |
|----------|----------|------------|
| Project list with create/import | File tree with test detection | Logs, results, and artifacts |

## Licence

Private — all rights reserved.
