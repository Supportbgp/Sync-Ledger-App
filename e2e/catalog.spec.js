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

test('selling the last copy of an item marks it sold', async ({ page }, testInfo) => {
  // Blastoise (sku-2) was seeded with qty 1 — SellModal should skip the
  // quantity stepper and go straight to a plain confirmation. Default sort
  // is by name ascending, so Blastoise sorts before Charizard either way.
  const blastoiseCardHead = page.locator('.catalog-card-head').filter({ hasText: 'Blastoise' });
  if (testInfo.project.name === 'Mobile') {
    await blastoiseCardHead.click();
  }
  await page.getByRole('button', { name: 'Sell' }).first().click();
  await expect(page.getByText('Mark this item as sold?')).toBeVisible();
  await page.getByRole('button', { name: 'Mark sold' }).click();

  await expect(page.getByText('Mark this item as sold?')).toHaveCount(0);
  if (testInfo.project.name === 'Mobile') await blastoiseCardHead.click();
  await expect(page.locator('.badge.sold')).toBeVisible();
});
