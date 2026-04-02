# SKILL: playwright-runner

## Purpose

Guide the correct use of the local Playwright binary for test execution, config reading, and result parsing in PW Studio.

## When to Use

- Running or managing Playwright test execution from the server.
- Reading Playwright project configuration from a project's `playwright.config.ts`.
- Parsing test results from the JSON reporter output.
- Resolving the local Playwright binary path.

## Procedure

### Binary Resolution

1. Always resolve the Playwright binary from the project's local `node_modules` — never use `npx playwright` or a global binary.
2. Use the utility in `src/server/utils/playwrightConfigOverride.ts` (or equivalent) for resolution.
3. If the binary is not found, report a health-check failure — do not fall back to a global install.

### Running Tests

1. Spawn Playwright as a child process using `src/server/services/` runner logic — do not call the Playwright API directly.
2. Use the `--reporter=json` flag (or the configured reporter) to capture structured output.
3. Stream stdout and stderr to connected WebSocket clients via `WS_EVENTS` push events during the run.
4. Capture the process exit code and map it to a run status (`passed`, `failed`, `interrupted`).
5. On Windows, handle process termination carefully — use the child process spawn utilities rather than raw `child_process` to ensure clean cancellation.

### Config Reading

1. Read the project's `playwright.config.ts` to extract `testDir`, named projects, and output directory.
2. Use dynamic import or the config reader utility in `src/server/utils/` — do not parse the config file as plain text.
3. Expose the config summary via the project health check endpoint.

### Result Parsing

1. Parse the JSON reporter output from the Playwright run to extract per-test results.
2. Map results to the `run_results` table schema.
3. Extract artefact paths (traces, screenshots, videos) from the result and apply the artefact policy.

## Output / Expected Result

- Test execution that streams logs in real time and stores results in the database.
- Binary resolution that surfaces a health-check failure rather than silently degrading.
- Config summary available to the health check and explorer.

## Notes

- The local binary path varies by OS — always construct it from `node_modules/.bin/playwright` relative to the project root.
- Playwright runs are long-lived child processes — ensure cancellation is handled and the process group is cleaned up on Windows.
