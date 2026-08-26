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

test('create from scratch, add cards via the catalog typeahead and freeform, accept, and see them land in Sorting', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Quote' }).click();
  await page.getByPlaceholder('e.g. Jake binder proposal').fill('Jake binder proposal');
  await page.getByRole('button', { name: 'Create' }).click();

  // A new quote is never persisted until the first real Save — the detail
  // view opens as "New quote" with no number yet.
  await expect(page.locator('.modal-head .name', { hasText: 'New quote — Jake binder proposal' })).toBeVisible();

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

  await expect(page.locator('.modal-head .name')).toHaveCount(0);

  // Accepting no longer writes straight to Catalog — both items move to
  // the Sorting queue to be placed individually (see the Sorting stage in
  // CLAUDE.md); Catalog stays untouched until that happens. (Charizard
  // already exists in Catalog from this file's own seed — used above for
  // the typeahead match — so "Unlisted Promo Card" is the one that proves
  // this: it has no other way to end up in Catalog.)
  await page.locator('.tab', { hasText: 'Catalog' }).click();
  await expect(page.locator('.panel.active').getByText('Unlisted Promo Card')).toHaveCount(0);

  await page.locator('.tab', { hasText: 'Sorting' }).click();
  const sortingPanel = page.locator('.panel.active');
  await expect(sortingPanel.getByText('Charizard')).toBeVisible();
  await expect(sortingPanel.getByText('Unlisted Promo Card')).toBeVisible();

  await page.locator('.tab', { hasText: 'Quote' }).click();
  // Saving is what actually creates the row — it should now show up in the
  // list (identified by collection name, not a gapped quote number — see
  // CLAUDE.md) with the Accepted Cash status/green tint.
  const quoteRow = page.locator('table tbody tr', { hasText: 'Jake binder proposal' });
  await expect(quoteRow).toBeVisible();
  await expect(quoteRow).toContainText('Accepted Cash');
  await expect(quoteRow).toHaveClass(/quote-row-accepted/);

  // The quote number still shows inside its own detail view, just not in
  // the list — reopening it should read "Quote #1", not "New quote".
  await quoteRow.click();
  await expect(page.locator('.modal-head .name', { hasText: 'Quote #1' })).toBeVisible();
});

test('quote detail sections collapse and expand independently', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Quote' }).click();
  await page.getByPlaceholder('e.g. Jake binder proposal').fill('Collapsible sections test');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.modal-head .name', { hasText: 'New quote' })).toBeVisible();

  // All four sections start expanded.
  await expect(page.getByText('Customer name')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add card manually' })).toBeVisible();

  // Collapsing "Quote details" hides its fields but leaves the others alone.
  const detailsHeader = page.locator('.section-label', { hasText: 'Quote details' });
  await detailsHeader.click();
  await expect(page.getByText('Customer name')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ Add card manually' })).toBeVisible();

  // Collapsing "Cards" independently hides the add-card buttons.
  const cardsHeader = page.locator('.section-label', { hasText: 'Cards (' });
  await cardsHeader.click();
  await expect(page.getByRole('button', { name: '+ Add card manually' })).toHaveCount(0);

  // Re-expanding "Quote details" brings its fields back.
  await detailsHeader.click();
  await expect(page.getByText('Customer name')).toBeVisible();
});

test('cancelling a never-saved new quote leaves no trace — nothing to resume, no quote created', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Quote' }).click();
  await page.getByPlaceholder('e.g. Jake binder proposal').fill('Abandoned attempt');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.modal-head .name', { hasText: 'New quote' })).toBeVisible();

  await page.getByRole('button', { name: '+ Add card manually' }).click();
  await page.getByPlaceholder('Card name').fill('Should not be saved');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.locator('.modal-head .name')).toHaveCount(0);
  await expect(page.getByText('No quotes yet')).toBeVisible();

  // Nothing was ever persisted, so "+ New Quote" has nothing to resume.
  await page.getByRole('button', { name: '+ New Quote' }).click();
  await expect(page.getByText('Resume a collection')).toHaveCount(0);
});
