import { test, expect } from '@playwright/test';
import { seedHarness, catalogSeed } from './fixtures.js';

// Every tab panel stays mounted in the DOM (App.jsx toggles a CSS `active`
// class rather than conditionally rendering) — the tests below scope to
// `.panel.active` wherever "is this on the tab I'm currently looking at"
// matters, since a bare page-wide text query would also match the same
// item's markup sitting hidden in another tab's panel.
function activePanel(page) {
  return page.locator('.panel.active');
}

test.beforeEach(async ({ page }) => {
  await seedHarness(page, { seed: catalogSeed([]) });
  await page.goto('./');
});

async function acceptQuoteWithOneItem(page, { collectionName, cardName, price }) {
  await page.locator('.tab', { hasText: 'Quote' }).click();
  await page.getByRole('button', { name: '+ New Quote' }).click();
  await page.getByPlaceholder('e.g. Jake binder proposal').fill(collectionName);
  await page.getByRole('button', { name: 'Create' }).click();

  await page.getByRole('button', { name: '+ Add card manually' }).click();
  await page.getByPlaceholder('Card name').fill(cardName);
  await page.locator('.scan-row').first().locator('select').first().selectOption('Pokemon');
  await page.locator('.scan-row').first().locator('input[placeholder="Price"]').fill(String(price));

  await page.locator('.field-group', { hasText: 'Offer status' }).locator('select').selectOption('accepted_cash');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.modal-head .name')).toHaveCount(0);
}

test('accepting a quote moves its items to Sorting, not straight to Catalog', async ({ page }) => {
  await acceptQuoteWithOneItem(page, { collectionName: 'Jake binder proposal', cardName: 'Charizard', price: 40 });

  // Not in Catalog yet — it's still waiting to be sorted.
  await page.locator('.tab', { hasText: 'Catalog' }).click();
  await expect(activePanel(page).getByText('Charizard')).toHaveCount(0);

  await page.locator('.tab', { hasText: 'Sorting' }).click();
  await expect(activePanel(page).getByText('Charizard')).toBeVisible();
  await expect(activePanel(page).getByText('From Jake binder proposal')).toBeVisible();
});

test('sorting a card individually creates a real Catalog row at the chosen location', async ({ page }) => {
  await acceptQuoteWithOneItem(page, { collectionName: 'Jake binder proposal', cardName: 'Charizard', price: 40 });

  await page.locator('.tab', { hasText: 'Sorting' }).click();
  await activePanel(page).getByRole('button', { name: 'Sort' }).click();

  const sortModal = page.locator('.modal', { hasText: 'Sort: Charizard' });
  await expect(sortModal).toBeVisible();
  const sortSave = sortModal.getByRole('button', { name: 'Confirm' });
  await expect(sortSave).toBeDisabled();

  await page.getByLabel('Binder / case / collection').fill('Red binder');
  await sortModal.locator('#si_posChannel').check();
  await expect(sortSave).toBeEnabled();
  await sortSave.click();

  // Gone from Sorting, now a real Catalog row.
  await expect(activePanel(page).getByText('Nothing waiting')).toBeVisible();
  await page.locator('.tab', { hasText: 'Catalog' }).click();
  await expect(activePanel(page).getByText('Charizard')).toBeVisible();
});

test('adding a card to Bulk increments a running (location, game) count instead of creating a per-card row', async ({ page }) => {
  await acceptQuoteWithOneItem(page, { collectionName: 'Collection A', cardName: 'Bulk Common #1', price: 1 });
  await page.locator('.tab', { hasText: 'Sorting' }).click();
  await activePanel(page).getByRole('button', { name: 'Sort' }).click();

  let sortModal = page.locator('.modal', { hasText: 'Sort: Bulk Common #1' });
  await sortModal.getByRole('button', { name: 'Add to Bulk' }).click();
  await page.getByLabel('Binder / case / collection').fill('Bulk box');
  const sortSave = sortModal.getByRole('button', { name: 'Confirm' });
  await expect(sortSave).toBeEnabled(); // bulk mode needs only a location, no channels
  await sortSave.click();

  await page.locator('.tab', { hasText: 'Catalog' }).click();
  await expect(activePanel(page).getByText('Bulk — Pokemon')).toBeVisible();
  // On mobile the Bulk badge lives inside the card's expanded details, so
  // tap the name first — a harmless no-op on the desktop table, which has
  // no such collapse/expand behavior.
  await activePanel(page).getByText('Bulk — Pokemon').click();
  await expect(activePanel(page).locator('.badge.bulk', { hasText: 'Bulk' }).first()).toBeVisible();

  // A second card sorted into the same binder+game increments the same
  // row instead of creating a second one.
  await page.locator('.tab', { hasText: 'Quote' }).click();
  await acceptQuoteWithOneItem(page, { collectionName: 'Collection B', cardName: 'Bulk Common #2', price: 1 });
  await page.locator('.tab', { hasText: 'Sorting' }).click();
  await activePanel(page).getByRole('button', { name: 'Sort' }).click();
  sortModal = page.locator('.modal', { hasText: 'Sort: Bulk Common #2' });
  await sortModal.getByRole('button', { name: 'Add to Bulk' }).click();
  await page.getByLabel('Binder / case / collection').selectOption('Bulk box');
  await sortModal.getByRole('button', { name: 'Confirm' }).click();

  await page.locator('.tab', { hasText: 'Catalog' }).click();
  await expect(activePanel(page).getByText('Bulk — Pokemon')).toHaveCount(1);
});

test('batch-selecting several items sorts them all to the same location at once', async ({ page }) => {
  await page.locator('.tab', { hasText: 'Quote' }).click();
  await page.getByRole('button', { name: '+ New Quote' }).click();
  await page.getByPlaceholder('e.g. Jake binder proposal').fill('Multi-card collection');
  await page.getByRole('button', { name: 'Create' }).click();

  for (const name of ['Card A', 'Card B']) {
    await page.getByRole('button', { name: '+ Add card manually' }).click();
    const row = page.locator('.scan-row').last();
    await row.locator('input[placeholder="Card name"]').fill(name);
    await row.locator('select').first().selectOption('Pokemon');
    await row.locator('input[placeholder="Price"]').fill('5');
  }
  await page.locator('.field-group', { hasText: 'Offer status' }).locator('select').selectOption('accepted_cash');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.modal-head .name')).toHaveCount(0);

  await page.locator('.tab', { hasText: 'Sorting' }).click();
  const panel = activePanel(page);
  await panel.getByText('Select all').click();
  await panel.getByRole('button', { name: /Sort selected/ }).click();

  const sortModal = page.locator('.modal', { hasText: 'Sort 2 items' });
  await expect(sortModal).toBeVisible();
  await page.getByLabel('Binder / case / collection').fill('Shared binder');
  await sortModal.locator('#si_posChannel').check();
  await sortModal.getByRole('button', { name: 'Confirm' }).click();

  await expect(panel.getByText('Nothing waiting')).toBeVisible();
  await page.locator('.tab', { hasText: 'Catalog' }).click();
  await expect(activePanel(page).getByText('Card A')).toBeVisible();
  await expect(activePanel(page).getByText('Card B')).toBeVisible();
});

test('cancelling the sort modal leaves the item in Sorting, unplaced', async ({ page }) => {
  await acceptQuoteWithOneItem(page, { collectionName: 'Jake binder proposal', cardName: 'Charizard', price: 40 });
  await page.locator('.tab', { hasText: 'Sorting' }).click();
  await activePanel(page).getByRole('button', { name: 'Sort' }).click();

  const sortModal = page.locator('.modal', { hasText: 'Sort: Charizard' });
  await sortModal.getByRole('button', { name: 'Cancel' }).click();

  await expect(sortModal).toHaveCount(0);
  await expect(activePanel(page).getByText('Charizard')).toBeVisible();
});
