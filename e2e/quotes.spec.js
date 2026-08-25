import { test, expect } from '@playwright/test';
import { seedHarness, makeCardRow, catalogSeed } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await seedHarness(page, {
    seed: catalogSeed([
      makeCardRow({ sku: 'sku-1', name: 'Charizard', game: 'Pokemon', set_name: 'Base Set', base_price: 50 }),
    ]),
  });
  await page.goto('./');
  await page.locator('.tab', { hasText: 'Quote' }).click();
});

test('create from scratch, add cards via the catalog typeahead and freeform, accept, and see them land in Catalog', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Quote' }).click();
  await page.getByPlaceholder('e.g. Jake binder proposal').fill('Jake binder proposal');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.locator('.modal-head .name', { hasText: 'Quote #1' })).toBeVisible();

  // Row 1: typeahead match against the seeded catalog item.
  await page.getByRole('button', { name: '+ Add card manually' }).click();
  const nameInputs = page.getByPlaceholder('Card name');
  await nameInputs.first().fill('Charizard');
  await page.locator('.catalog-item-picker-option', { hasText: 'Charizard' }).click();

  const rows = page.locator('.scan-row');
  await expect(rows.first().locator('select').first()).toHaveValue('Pokemon');
  await rows.first().locator('input[placeholder="Price"]').fill('40');

  // Row 2: a freeform name with no catalog match — still a valid row.
  await page.getByRole('button', { name: '+ Add card manually' }).click();
  await nameInputs.last().fill('Unlisted Promo Card');
  await rows.last().locator('input[placeholder="Price"]').fill('10');

  await expect(page.getByText('Total quoted value')).toBeVisible();
  await expect(page.getByText('$50.00')).toBeVisible(); // 40 + 10

  await page.locator('.field-group', { hasText: 'Offer status' }).locator('select').selectOption('accepted_cash');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('.modal-head .name', { hasText: 'Quote #1' })).toHaveCount(0);

  await page.locator('.tab', { hasText: 'Catalog' }).click();
  await expect(page.getByText('Charizard').first()).toBeVisible();
  await expect(page.getByText('Unlisted Promo Card')).toBeVisible();

  await page.locator('.tab', { hasText: 'Quote' }).click();
  await expect(page.getByText('Accepted Cash')).toBeVisible();
});
