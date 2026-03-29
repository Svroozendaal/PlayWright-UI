# DECISIONS_LOG

## TEMPLATE

```markdown
## DECISION - [id] - [timestamp]
CONTEXT: [...]
DECISION: [...]
RATIONALE: [...]
ALTERNATIVES_REJECTED: [...]
```

## LIVE_LOG

## DECISION - ARCH-001 - 2026-03-28
CONTEXT: PW Studio was built as an Electron desktop application with preload, IPC handlers, and Electron packaging. The product direction changed to a lighter local web runtime.
DECISION: Migrate PW Studio to a local Node.js web architecture with an Express server, React SPA, REST API, and WebSocket push transport.
RATIONALE: This removes Electron overhead, simplifies packaging, makes the runtime accessible to AI and MCP integrations over HTTP, and preserves the existing product capability set.
ALTERNATIVES_REJECTED: Keep Electron and optimise incrementally; move to a remote hosted service; defer the transport migration but add more IPC abstractions.

## DECISION - ARCH-002 - 2026-03-28
CONTEXT: The runtime needs a deterministic development topology and a clear production story.
DECISION: Use a fixed localhost backend port in development with Vite proxying `/api` and `/ws`, and serve the built SPA from the same local server in production.
RATIONALE: This keeps the browser client simple, supports same-origin production behaviour, and avoids runtime bootstrap complexity for randomly assigned ports.
ALTERNATIVES_REJECTED: Random server port discovery; single-server development without Vite.

## DECISION - ARCH-003 - 2026-03-28
CONTEXT: The migration introduces HTTP and WebSocket boundaries that need a stable, documented contract.
DECISION: Keep the envelope pattern as the canonical transport wrapper, introducing `ApiEnvelope<T>` with `IpcEnvelope<T>` retained temporarily as an alias during the cutover. Define request routes and push events separately as `API_ROUTES` and `WS_EVENTS`.
RATIONALE: This reduces frontend and backend churn while preserving stable response semantics and making the transport explicit for OpenAPI and MCP use.
ALTERNATIVES_REJECTED: Remove the envelope pattern entirely; keep IPC constant naming unchanged for both HTTP and WebSocket traffic.

## DECISION - ARCH-004 - 2026-03-28
CONTEXT: The renderer was written entirely against `window.api.invoke()` and IPC channel names, but the migration still needed to land atomically without rewriting every domain call shape at once.
DECISION: Introduce a browser-side `api.invoke(channel, payload)` compatibility layer that maps the legacy IPC identifiers to REST methods and paths, while replacing push subscriptions with a singleton WebSocket hook.
RATIONALE: This keeps the frontend diff focused on transport and dialog changes, preserves the existing domain payloads during the cutover, and leaves room to simplify page-level calls further later.
ALTERNATIVES_REJECTED: Rewrite every page and component directly to raw route strings in one pass; preserve `window.api` indefinitely.

## DECISION - ARCH-005 - 2026-03-28
CONTEXT: Electron save/open dialogs are no longer available in the browser runtime, but the project-creation, import, and recorder flows still need filesystem selection.
DECISION: Replace native dialogs with an in-app folder picker backed by `/api/directories/browse`, and handle recorder output as folder selection plus explicit file name input.
RATIONALE: This keeps the app local-first and browser-safe, works across operating systems, and preserves the recorder workflow without requiring privileged browser APIs.
ALTERNATIVES_REJECTED: Add a desktop-only file-system API dependency; restrict recorder output to a hard-coded project-relative path.

## DECISION - UX-006 - 2026-03-28
CONTEXT: The recorder page defaulted the output folder to the project root, while Explorer and file watching intentionally index the resolved Playwright `testDir`.
DECISION: Resolve the preferred recorder output folder from the Playwright config summary and default the recorder UI to `testDir`, with the project root retained only as a fallback when config discovery fails.
RATIONALE: This keeps generated recordings inside the indexed test tree so new files appear in Explorer immediately and behave like the rest of the test suite.
ALTERNATIVES_REJECTED: Expand Explorer to index the entire project root; leave the root default and rely on manual folder changes.

## DECISION - ARCH-007 - 2026-03-28
CONTEXT: The dynamic Playwright config reader silently returned defaults when it failed to import a config file, which masked configured browser project names for `.ts` configs.
DECISION: Treat dynamic import failure as a real failure so the reader falls back to regex parsing instead of emitting default values under the `config` read path.
RATIONALE: This preserves configured browser project names in the UI and avoids false confidence that the config was fully evaluated.
ALTERNATIVES_REJECTED: Keep the silent fallback; remove dynamic import support entirely and rely only on regex parsing.
