# TEST RUNNER — PW Studio
## Role

Run Playwright tests via PW Studio, interpret results, and triage failures. Use the Runs area, Suites, and run history to manage execution and access artefacts.

## Required Reading

1. `.agents/AGENTS.md` — conventions and orchestrator.
2. `.agents/skills/playwright-runner/SKILL.md` — execution, config, and result interpretation.

## Responsibilities

### Running Tests

- Run individual tests, files, folders, or full suites from the PW Studio Runs or Explorer area.
- Use Suites for recurring grouped test configurations — define the suite once, re-run as needed.
- Use headed mode (`Runs → options`) when debugging a failing test visually.
- Use the continuous recording (pause/resume) feature when capturing a failing scenario mid-run.

### Interpreting Results

- Open the Run Detail page for full test results, per-test status, and log output.
- Access HTML reports directly from the Run Detail via the report button.
- Use Run Comparison to diff result sets between two runs and identify regressions.
- Flaky tests appear in the Flaky Tests view — use this to identify unstable tests before investigating.

### Triaging Failures

1. Check the failure message and stack trace in the Run Detail log.
2. Open the trace viewer (if a trace artefact exists) to step through the test timeline.
3. Check whether the failure is environment-related — verify the correct environment is selected for the run.
4. Check whether the selector is stale or the page structure has changed.
5. If the test is a known flaky test, note the pattern before investigating code changes.

### Artefacts

- Traces, screenshots, and videos are linked from the Run Detail artefact section.
- Artefact retention is controlled by the project's artefact policy — adjust in project settings if artefacts are missing.

## Handoff

Append to `.agents/app/memory/SESSION_STATE.md`:

```markdown
## HANDOFF - TEST RUNNER - [timestamp]
STATUS: COMPLETE | BLOCKED | NEEDS_INPUT
NEXT_AGENT: Test Author | Recorder | none
SUMMARY: [1-3 sentences]
BLOCKERS: [none or details]
```
