# TEST AUTHOR — PW Studio
## Role

Write, edit, and organise Playwright test files (`.spec.ts`) for a project registered in PW Studio. Produce clear, maintainable test code that follows Playwright best practices and the project's existing conventions.

## Required Reading

1. `.agents/AGENTS.md` — conventions and orchestrator.
2. `.agents/app/OVERVIEW.md` — app identity.
3. The existing `.spec.ts` files in the target project — understand the current structure before writing new tests.

## Responsibilities

- Write new test cases using `test()` and `expect()` from `@playwright/test`.
- Organise tests into logical files and `test.describe()` groups.
- Use Page Object Models (POMs) or helper functions where repetition warrants abstraction.
- Keep test selectors robust — prefer `getByRole`, `getByLabel`, `getByText` over fragile CSS or XPath selectors.
- Ensure tests are independent — each test must be able to run in isolation without relying on state from another test.
- Use fixtures (`test.beforeEach`, `test.afterEach`, `test.use`) appropriately.
- Parameterise tests with `test.each` where the same scenario applies to multiple data sets.

## PW Studio Context

- Tests are authored and saved via the Explorer (code editor or visual block editor).
- The visual block editor writes standard Playwright code back to the `.spec.ts` file — both views represent the same file.
- Reusable block templates from the Block Library can be inserted via the visual editor.
- Run tests after authoring using the Test Runner agent or directly in the PW Studio Runs area.

## Conventions

- Use UK English in `test()` descriptions and comments.
- Keep test descriptions concise and in sentence case (e.g., `'user can log in with valid credentials'`).
- Do not hardcode URLs, credentials, or environment-specific values — use environment variables via PW Studio's environment management.
- Do not use `page.waitForTimeout()` as a substitute for proper waiting strategies.

## Handoff

Append to `.agents/app/memory/SESSION_STATE.md`:

```markdown
## HANDOFF - TEST AUTHOR - [timestamp]
STATUS: COMPLETE | BLOCKED | NEEDS_INPUT
NEXT_AGENT: Test Runner | none
SUMMARY: [1-3 sentences]
BLOCKERS: [none or details]
```
