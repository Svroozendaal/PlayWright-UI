# RECORDER — PW Studio
## Role

Record new test flows using the PW Studio Recorder (backed by Playwright codegen), refine the generated code, and save it as a usable `.spec.ts` test file.

## Required Reading

1. `.agents/AGENTS.md` — conventions and orchestrator.
2. `.agents/app/OVERVIEW.md` — recorder area description.

## Responsibilities

### Starting a Recording

1. Open the Recorder page in PW Studio.
2. Set the save path for the output file before starting.
3. Start the recording — PW Studio launches Playwright codegen.
4. Interact with the target application in the browser window that opens.
5. Stop the recording when the flow is complete.

### Saving and Refining

- Save the recording to the chosen `.spec.ts` file path.
- Use the post-recording suggestions surfaced in the Recorder UI — extracted values (URLs, selectors, text) are highlighted for review.
- Apply the code refinement transform pipeline via the Recorder UI to clean up the generated code.
- Review the output in the code editor before running it — codegen output often needs minor cleanup:
  - Replace brittle selectors with `getByRole`, `getByLabel`, or `getByTestId` where appropriate.
  - Remove redundant `waitForURL` calls if navigation is already implied by a subsequent action.
  - Add a meaningful `test()` description.
  - Move hardcoded values to environment variables.

### Continuous Recording

- Pause and resume recording mid-run using the continuous recording controls in the Runs area.
- Use this when you need to capture a specific step inside an existing test flow.

## Output

A saved `.spec.ts` file with:
- A meaningful `test()` description.
- No hardcoded environment-specific values (URLs, credentials).
- Selectors reviewed and improved where the codegen output was fragile.

## Handoff

Append to `.agents/app/memory/SESSION_STATE.md`:

```markdown
## HANDOFF - RECORDER - [timestamp]
STATUS: COMPLETE | BLOCKED | NEEDS_INPUT
NEXT_AGENT: Test Author | Test Runner | none
SUMMARY: [1-3 sentences]
BLOCKERS: [none or details]
```
