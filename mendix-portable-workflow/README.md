# Mendix Portable Codegen Workflow

This folder provides a small workflow to turn Playwright codegen output into data-agnostic Mendix tests.

## Goal

Replace brittle data selectors like:

```ts
await page.getByRole('cell', { name: 'Achternaam1023' }).click();
```

with stable Mendix-oriented pointer calls that click rows/cells by structure, not record value.

## Folder Layout

- `scripts/normalize-codegen.js`: rewrites fragile locators in generated `.spec.ts` files.
- `scripts/record-to-portable.ps1`: optional wrapper around `playwright codegen` + normalize step.
- `templates/mendix-pointers.ts`: helper functions used by normalized tests.
- `config/mendix-map.example.json`: optional config for app-specific hints.
- `AUTOMATION.md`: runbook/checklist for repeatable usage.

## Quick Start

1. Record a test:

```powershell
cd Project109-tests
npx playwright codegen http://localhost:8012/local.html --output tests/recordings/session.raw.spec.ts
```

2. Normalize it:

```powershell
node ..\mendix-portable-workflow\scripts\normalize-codegen.js `
  --input tests/recordings/session.raw.spec.ts `
  --output tests/portable/session.spec.ts `
  --map ..\mendix-portable-workflow\config\mendix-map.example.json `
  --helperImport "../support/mendix-pointers"
```

3. Copy helper template once:

- Copy `mendix-portable-workflow/templates/mendix-pointers.ts` to `Project109-tests/tests/support/mendix-pointers.ts`.

4. Run tests:

```powershell
npx playwright test tests/portable/session.spec.ts
```

## Current Rewrite Rules

- `getByRole('cell', { name: '...' }).click()` where value looks dynamic (digits/UUID-like) -> `mx.clickRowCell(...)`
- other `getByRole('cell', { name: '...' }).click()` -> `mx.clickRowCell(...)` with lower confidence comment

Unknown cases are left unchanged and marked with `// TODO(pointer)` where applicable.

