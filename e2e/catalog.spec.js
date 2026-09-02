import { test, expect } from '@playwright/test';
import { seedHarness, makeCardRow, catalogSeed } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await seedHarness(page, {
    seed: catalogSeed([
      makeCardRow({ sku: 'sku-1', name: 'Charizard', qty: 3 }),
      makeCardRow({ sku: 'sku-2', name: 'Blastoise', qty: 1, sold: false }),
    ]),
  });
  await page.goto('./');
});

test('desktop shows a real table with both seeded rows', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop', 'table-vs-cards is desktop/mobile-specific');
  await expect(page.locator('table')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Charizard' }).first()).toBeVisible();
  await expect(page.getByText('Blastoise')).toBeVisible();
});

test('mobile shows stacked cards instead of a table, collapsed until tapped', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Mobile', 'table-vs-cards is desktop/mobile-specific');
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  await expect(page.getByText('Edit')).toHaveCount(0);

  await page.getByText('Charizard').click();
  await expect(page.getByText('Edit').first()).toBeVisible();
});

test('adding a new item shows up in the catalog immediately', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add item' }).click();
  await expect(page.getByText('Add item', { exact: true })).toBeVisible();

  const nameInput = page.locator('.modal.wide input[type="text"]').first();
  await nameInput.fill('Sol Ring');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Add item', { exact: true })).toHaveCount(0);
  await expect(page.locator('.n-name', { hasText: 'Sol Ring' })).toBeVisible();
});

test('Load more reveals every match past the 400-row render cap', async ({ page }, testInfo) => {
  const manyRows = Array.from({ length: 450 }, (_, i) => makeCardRow({ sku: `sku-many-${i}`, name: `Filler Card ${i}` }));
  await seedHarness(page, { seed: catalogSeed(manyRows) });
  await page.goto('./');

  const rowLocator = testInfo.project.name === 'Mobile' ? page.locator('.catalog-card') : page.locator('table tbody tr');
  await expect(page.getByText('Showing 400 of 450 matches.')).toBeVisible();
  await expect(rowLocator).toHaveCount(400);

  const loadMore = page.getByRole('button', { name: 'Load more…' });
  await expect(loadMore).toBeVisible();
  await loadMore.click();

  await expect(page.getByText(/Showing \d+ of 450 matches\./)).toHaveCount(0);
  await expect(loadMore).toHaveCount(0);
  await expect(rowLocator).toHaveCount(450);
});

test('selecting an item and clicking Mark sold marks it sold', async ({ page }, testInfo) => {
  // There's no more per-row Sell button — selling goes through the same
  // multi-select flow as Delete: select the row, then use the batch bar's
  // "Mark sold". On mobile that's the row's own checkbox (tapping elsewhere
  // on the card head still just expands/collapses it, unchanged); on
  // desktop, clicking anywhere on the row selects it.
  if (testInfo.project.name === 'Mobile') {
    await page.locator('.catalog-card-head').filter({ hasText: 'Blastoise' }).locator('input[type="checkbox"]').check();
  } else {
    await page.getByText('Blastoise').click();
  }
  await page.getByRole('button', { name: 'Mark sold' }).click();
  await expect(page.getByText(/Mark 1 selected item\(s\) as sold\?/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText(/Mark 1 selected item\(s\) as sold\?/)).toHaveCount(0);
  await expect(page.locator('.badge.sold')).toBeVisible();
});

test('clicking anywhere on a desktop row selects it, and clicking Edit does not', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop', 'click-to-select-a-row is desktop-table-specific');
  const row = page.locator('table tbody tr').filter({ hasText: 'Charizard' });
  await row.getByText('Charizard').click();
  await expect(row).toHaveClass(/row-selected/);
  await expect(page.getByRole('button', { name: 'Mark sold' })).toBeVisible();

  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('Edit item')).toBeVisible();
});
