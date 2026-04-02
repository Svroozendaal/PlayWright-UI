# SKILL: expand-test

## Purpose

Take an existing Playwright test as a preset starting point and generate a thorough set of related tests that explore a specific part of the application under test in depth — covering happy paths, edge cases, boundary conditions, and error states.

## When to Use

- You have a test that establishes a known application state (logged in, navigated to a specific page, data pre-loaded) and you want to expand coverage from that point.
- You want to thoroughly test a specific feature, page, or interaction without rewriting the setup steps.
- You need to cover a range of input variations, error conditions, or user flows that all share the same preconditions.

## Procedure

### Step 1 — Identify the Seed Test

1. Open the source `.spec.ts` file in the PW Studio Explorer.
2. Identify the `test()` function that represents the starting conditions — the precondition block.
3. Note what state the test leaves the application in at the point where expansion should begin.
4. Confirm with the user: **"This test leaves the app in state X at step Y — is this the correct starting point for expansion?"**

### Step 2 — Define the Expansion Target

Ask the user (or infer from context) which aspect of the application to explore thoroughly:

- A specific UI component or interaction (e.g., a form, a modal, a data table)
- A specific user flow (e.g., all paths through a wizard)
- A specific data boundary (e.g., valid/invalid inputs, empty states, maximum lengths)
- A specific error condition (e.g., network failure, validation rejection, permission denied)

### Step 3 — Extract the Shared Setup

1. Identify the steps in the seed test that constitute the shared precondition (everything up to the expansion point).
2. Extract these steps into a `test.beforeEach` hook or a shared helper function if they are not already abstracted.
3. Do not modify the original seed test — work in a copy or a new `test.describe` block.

### Step 4 — Generate the Expanded Test Suite

For the target area, generate tests covering:

| Category | Examples |
|---|---|
| **Happy path variants** | The expected flow with different valid inputs |
| **Boundary conditions** | Min/max values, empty strings, maximum field lengths |
| **Invalid inputs** | Wrong format, out-of-range values, special characters |
| **Error states** | Validation messages, rejection responses, disabled states |
| **Edge cases** | Concurrent actions, rapid repeated interaction, unexpected sequences |
| **Accessibility** | Keyboard navigation, focus management (where relevant) |

Generate only what is realistic given the application context — do not fabricate interactions the application does not support.

### Step 5 — Structure the Output

Organise all expanded tests in a `test.describe` block named after the feature being explored:

```ts
test.describe('Feature: [name of area under test]', () => {
  test.beforeEach(async ({ page }) => {
    // shared setup from seed test
  })

  test('should [expected outcome for happy path variant 1]', async ({ page }) => { ... })
  test('should [expected outcome for edge case]', async ({ page }) => { ... })
  test('should show [error message] when [invalid input]', async ({ page }) => { ... })
  // ...
})
```

### Step 6 — Review and Run

1. Save the expanded tests to the appropriate `.spec.ts` file.
2. Run the expanded suite via the PW Studio Runs area or Explorer.
3. Triage any failures — distinguish between real defects and incorrect test assumptions.
4. Refine selectors or assertions where the test was too strict or too loose.

## Output / Expected Result

A `test.describe` block containing 5–15 focused tests that:

- All share the same precondition from the seed test.
- Each test has a single, clearly stated assertion goal.
- Cover the happy path, at least two boundary conditions, and at least two error states for the target area.
- Use no hardcoded environment values — all environment-specific data comes from `process.env`.
- Use robust Playwright selectors (`getByRole`, `getByLabel`, `getByText`, `getByTestId`).

## Notes

- Keep each test independent — do not carry state between tests in the expanded suite.
- If the seed test's setup is expensive (slow login, heavy data load), ensure `test.beforeEach` handles it efficiently, or consider using `test.describe.serial` only if ordering is truly necessary.
- This skill pairs well with the **Test Runner** agent: after generating the expanded suite, hand off to Test Runner to execute and triage.
- If you discover that the target feature is not yet tested at all, consider using the **Recorder** agent first to capture the baseline flow before expanding.
