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
  // already be included with no extra clicks. Scoped to the Revenue stat
  // tile specifically — with no cost entered, Profit renders the identical
  // "$145.00" string, and a bare page-wide getByText would match both.
  await expect(page.locator('.stat-revenue')).toContainText('$145.00');
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

test('clicking a game row in the by-game breakdown expands to show its individual sold cards', async ({ page }) => {
  const now = new Date().toISOString();
  await seedHarness(page, {
    seed: {
      ...catalogSeed([]),
      sales: [
        makeSaleRow({ id: 's1', sku: 'sku-1', name: 'Charizard', game: 'Pokemon', condition: 'NM', qty_sold: 1, sale_price: 45, sold_at: now }),
        makeSaleRow({ id: 's2', sku: 'sku-2', name: 'Pikachu', game: 'Pokemon', condition: 'LP', qty_sold: 2, sale_price: 5, sold_at: now }),
        makeSaleRow({ id: 's3', sku: 'sku-3', name: 'Black Lotus', game: 'Magic', condition: 'NM', qty_sold: 1, sale_price: 100, sold_at: now }),
      ],
    },
  });
  await page.goto('./');
  await page.locator('.tab', { hasText: 'Reports' }).click();

  const pokemonRow = page.locator('table tbody tr', { hasText: 'Pokemon' });
  const magicRow = page.locator('table tbody tr', { hasText: 'Magic' });

  // No drill-down rows visible until a game row is clicked.
  await expect(page.getByText('Pikachu')).not.toBeVisible();
  await expect(page.getByText('Black Lotus')).not.toBeVisible();

  await pokemonRow.click();
  await expect(page.getByText('Charizard')).toBeVisible();
  await expect(page.getByText('Pikachu')).toBeVisible();
  // Only Pokemon's rows show — Magic's own sale isn't mixed in.
  await expect(page.getByText('Black Lotus')).not.toBeVisible();

  // Expanding a different game doesn't require collapsing the first by hand
  // first — only one game's drill-down is open at a time, so Pokemon's own
  // rows close automatically.
  await magicRow.click();
  await expect(page.getByText('Black Lotus')).toBeVisible();
  await expect(page.getByText('Pikachu')).not.toBeVisible();

  // Clicking the same row again collapses it back.
  await magicRow.click();
  await expect(page.getByText('Black Lotus')).not.toBeVisible();
});

test('Cost/Profit reflect only sales with a recorded cost, flagging the rest', async ({ page }) => {
  const now = new Date().toISOString();
  await seedHarness(page, {
    seed: {
      ...catalogSeed([]),
      sales: [
        makeSaleRow({ id: 's1', sku: 'sku-1', name: 'Charizard', game: 'Pokemon', qty_sold: 1, sale_price: 45, cost: 20, sold_at: now }),
        makeSaleRow({ id: 's2', sku: 'sku-2', name: 'Black Lotus', game: 'Magic', qty_sold: 1, sale_price: 100, cost: null, sold_at: now }),
      ],
    },
  });
  await page.goto('./');
  await page.locator('.tab', { hasText: 'Reports' }).click();

  // Cost/Profit only count the Charizard sale (the one with a real cost) —
  // Black Lotus's missing cost contributes 0, not a guess. Scoped to the
  // stat tiles specifically — the by-game table's own Pokemon row renders
  // an identical "$20.00" Cost cell, which a bare page-wide getByText would
  // also match.
  await expect(page.locator('.stat-cost')).toContainText('$20.00');
  await expect(page.locator('.stat-profit')).toContainText('$125.00'); // 145 revenue - 20 cost
  await expect(page.getByText(/1 sale\(s\) in this range have no recorded cost/)).toBeVisible();
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
