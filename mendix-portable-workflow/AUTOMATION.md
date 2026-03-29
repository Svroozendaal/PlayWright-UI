# Automation Runbook

Use this checklist when recording a new Mendix flow and converting it to a portable Playwright test.

## One-Time Setup

1. Copy the helper into your Playwright project:
   - From: `mendix-portable-workflow/templates/mendix-pointers.ts`
   - To: `tests/support/mendix-pointers.ts`
2. Ensure the project has these folders:
   - `tests/recordings`
   - `tests/portable`
   - `.auth`
3. Add or update your `.env` with the app URL and login credentials.
4. Customize `mendix-portable-workflow/config/mendix-map.example.json` if you need container or row hints.

## Per-Flow Steps

1. Run the recorder/converter from the Playwright project root:

```powershell
node ..\mendix-portable-workflow\run-record-and-convert.js `
  --project "." `
  --url "https://<mendix-app>/local.html" `
  --raw "tests/recordings/<flow>.raw.spec.ts" `
  --portable "tests/portable/<flow>.spec.ts" `
  --config ".\playwright.config.ts" `
  --authSetupProject "setup-chromium" `
  --authState ".auth/primary.json" `
  --map "..\mendix-portable-workflow\config\mendix-map.example.json" `
  --helperImport "../support/mendix-pointers"
```

2. If you want to decide row versus cell during conversion, add:

```powershell
--promptRowModes
```

3. Record the flow in the codegen window and close it when finished.
4. Review the generated portable spec and run it in `portable-chromium`.

## Notes

- The recorder reuses `.auth/primary.json` when it already exists.
- `getByRole('cell', ...)` and `getByText(...).nth(...).click()` are both rewritten into `mx.clickRowCell(...)`.
- Use `contextToGrid` / `defaultGrid` for explicit grid scoping.
- Use `contextToRowMode` / `defaultRowMode` when a table row should be clicked instead of the cell text.
- If a row click is still ambiguous, strengthen the container hint in the map file.

## Done Criteria

1. No brittle data-specific selectors remain in the portable spec when a row/cell helper can express the action.
2. The test passes in at least two data states if the flow depends on table contents.
3. The portable spec keeps `test.use({ storageState: '.auth/primary.json' })` in place.
