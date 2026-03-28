# PW Studio

PW Studio is a local web application that wraps Playwright Test with a graphical user interface. It runs a local Node.js server and serves a browser UI on the same machine. It is an orchestration layer, not a replacement for Playwright.

## Requirements

- **Node.js** >= 20
- **npm** >= 10
- **Playwright** >= 1.40 (installed per project)
- **Modern browser** with WebSocket support

## Installation

### `npm`

```bash
npm install
npm run build
npm start
```

### Bundled local runtime

Unpack the bundled distribution, then run the provided start command from the package root.

## First Steps

1. **Create a project** — click "New Project", choose a name and folder, select browsers, and PW Studio will scaffold a Playwright project with `npm install`.
2. **Import an existing project** — click "Import Project" and use the in-app folder browser to select a folder that already contains a `playwright.config.ts`.
3. **Check health** — the Health Panel shows whether Node, npm, Playwright, and browsers are correctly set up.
4. **Run tests** — open the Explorer, pick a file or folder, and run it.
5. **View results** — navigate to the Runs page to see history, logs, and test results.

## Development

```bash
# Install dependencies
npm install

# Start local server + Vite
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build

# Start the built server
npm start
```

## Screenshots

| Projects | Explorer | Run Detail |
|----------|----------|------------|
| Project list with create/import | File tree with test detection | Logs, results, and artifacts |

## Licence

Private — all rights reserved.
