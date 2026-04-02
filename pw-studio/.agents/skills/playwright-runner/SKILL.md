# SKILL: playwright-runner

## Purpose

Guide correct test execution and result interpretation inside PW Studio — running tests, reading results, and understanding run configuration.

## When to Use

- Deciding how to run a specific test, file, folder, or suite.
- Interpreting run results, failure messages, or artefact output.
- Configuring run options (headed mode, environment, retry count).
- Investigating why a run produced unexpected results.

## Procedure

### Choosing What to Run

| Target | Where in PW Studio |
|---|---|
| Single test | Explorer → right-click test → Run |
| Single file | Explorer → right-click file → Run |
| Folder | Explorer → right-click folder → Run |
| Named suite | Runs → Suites → select suite → Run |
| Rerun failed tests | Run Detail → Rerun failed |

### Run Options

- **Headed mode** — opens a visible browser during the run; useful for debugging selectors and timing issues.
- **Environment** — select the active environment before running to inject the correct variables.
- **Retries** — configure in the project's `playwright.config.ts`; PW Studio surfaces retry results per test.
- **Continuous recording** — pause and resume recording during a run to capture a specific step mid-execution.

### Reading Results

- **Run Detail** — shows per-test status (passed, failed, skipped, flaky), duration, and log output.
- **HTML Report** — access via the report button on Run Detail; full Playwright HTML report with timeline and steps.
- **Trace viewer** — open from the artefact section of Run Detail if a trace was captured.
- **Run Comparison** — select two runs to diff their results and identify what changed between runs.
- **Flaky Tests** — dedicated view for tests that have inconsistent pass/fail history.

### Triaging a Failure

1. Open Run Detail → read the failure message and stack trace.
2. Check whether a trace artefact exists → open it for a step-by-step timeline with screenshots.
3. Check whether the correct environment was selected — a missing variable often causes cryptic failures.
4. Rerun in headed mode to observe what the browser does at the point of failure.
5. If the test is in the Flaky Tests list, note the failure pattern before changing any code.

### Artefacts

- Artefact availability (traces, screenshots, videos) depends on the project's artefact policy.
- Adjust the policy in project settings if expected artefacts are missing.

## Notes

- PW Studio always uses the project's local Playwright binary — never `npx playwright`.
- Suite configurations are stored per project and can be reused across runs.
