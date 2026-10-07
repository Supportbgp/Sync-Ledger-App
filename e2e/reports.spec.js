import { test, expect } from '@playwright/test';
import { seedHarness, catalogSeed } from './fixtures.js';

function makeSaleRow(overrides = {}) {
  return {
    id: 'sale-1', sku: 'sku-1', name: 'Charizard', game: 'Pokemon', condition: 'NM',
    qty_sold: 1, sale_price: 45, sold_at: new Date().toISOString(),
    ...overrides,
  };
}

test('Reports tab shows this month\'s totals and a by-game breakdown, sorted by revenue', async ({ page }) => {
  const now = new Date().toISOString();
  await seedHarness(page, {
    seed: {
      ...catalogSeed([]),
      sales: [
        makeSaleRow({ id: 's1', sku: 'sku-1', name: 'Charizard', game: 'Pokemon', qty_sold: 1, sale_price: 45, sold_at: now }),
        makeSaleRow({ id: 's2', sku: 'sku-2', name: 'Black Lotus', game: 'Magic', qty_sold: 1, sale_price: 100, sold_at: now }),
      ],
    },
  });
  await page.goto('./');
  await page.locator('.tab', { hasText: 'Reports' }).click();

  // "This month" is the default preset, so both sales (dated "now") should
  // already be included with no extra clicks.
  await expect(page.getByText('$145.00')).toBeVisible();
  const rows = page.locator('table tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Magic'); // higher revenue sorts first
  await expect(rows.nth(0)).toContainText('$100.00');
  await expect(rows.nth(1)).toContainText('Pokemon');
  await expect(rows.nth(1)).toContainText('$45.00');
});

test('a range with nothing sold shows the empty state, not a zeroed table', async ({ page }) => {
  await seedHarness(page, { seed: { ...catalogSeed([]), sales: [] } });
  await page.goto('./');
  await page.locator('.tab', { hasText: 'Reports' }).click();

  await expect(page.getByText('Nothing sold in this range')).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
});

test('Custom range prompts for both dates before loading anything', async ({ page }) => {
  await seedHarness(page, {
    seed: { ...catalogSeed([]), sales: [makeSaleRow()] },
  });
  await page.goto('./');
  await page.locator('.tab', { hasText: 'Reports' }).click();
  await page.getByRole('button', { name: 'Custom' }).click();

  await expect(page.getByText('Pick both dates')).toBeVisible();

  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill('2020-01-01');
  await dateInputs.nth(1).fill('2020-12-31');

  // The seeded sale is dated "now" (outside this custom 2020 range), so this
  // should land on the real "nothing sold" empty state, not the
  // pick-both-dates prompt — confirming the range actually took effect.
  await expect(page.getByText('Nothing sold in this range')).toBeVisible();
});
