import { expect, type Locator, type Page } from '@playwright/test';

type Confidence = 'high' | 'medium' | 'low';

type ClickRowCellOptions = {
  valueHint?: string;
  container?: string;
  confidence?: Confidence;
};

function pageFromScope(scope: Page | Locator): Page {
  return 'page' in scope && typeof scope.page === 'function' ? scope.page() : scope;
}

async function resolveContainer(scope: Page | Locator, container: string): Promise<Locator> {
  const page = pageFromScope(scope);

  if (container && container !== 'auto') {
    const byMxName = page.locator(`.mx-name-${container}`);
    if ((await byMxName.count()) > 0) return byMxName.first();

    const generic = page.locator(container);
    if ((await generic.count()) > 0) return generic.first();
  }

  // Auto mode: prefer visible dialog first, then any visible grid-like container.
  const dialog = page.getByRole('dialog').filter({ visible: true }).first();
  if ((await dialog.count()) > 0) return dialog;

  return page.locator('.mx-datagrid, .mx-grid, [role="grid"], table').filter({ visible: true }).first();
}

function dataRows(container: Locator): Locator {
  // Skip header rows when possible.
  return container
    .getByRole('row')
    .filter({ has: container.getByRole('cell') });
}

export const mx = {
  async clickRowCell(scope: Page | Locator, options: ClickRowCellOptions = {}): Promise<void> {
    const { valueHint = '', container = 'auto', confidence = 'low' } = options;
    const targetContainer = await resolveContainer(scope, container);
    const rows = dataRows(targetContainer);
    const rowCount = await rows.count();

    let firstCell: Locator;
    if (rowCount > 0) {
      // Choose first data row to avoid brittle value-based selectors.
      const row = rows.first();
      firstCell = row.getByRole('cell').first();
    } else {
      // Fallback for Mendix tables that expose cells but not row roles consistently.
      const page = pageFromScope(scope);
      firstCell = page.getByRole('cell').filter({ visible: true }).first();
      await expect(
        firstCell,
        `No role=cell candidates found for container="${container}" and valueHint="${valueHint}"`,
      ).toBeVisible();
    }

    await expect(firstCell).toBeVisible();
    await firstCell.click();

    // Keep this surfaced in trace/logs while the workflow matures.
    if (confidence !== 'high') {
      console.log(`[mx.pointer] clickRowCell used ${confidence} confidence fallback. valueHint="${valueHint}"`);
    }
  },
};
