import { test, expect } from '@playwright/test';

// No seedHarness call needed — this page never touches the database, and is
// reachable with no session at all (see main.jsx's ?help=1 branch).
test('renders every section with no login, at both viewport sizes', async ({ page }) => {
  await page.goto('./?help=1');

  await expect(page.getByRole('heading', { name: 'Getting started' })).toBeVisible();
  // Public/no-auth page never shows authenticated-app chrome.
  await expect(page.getByRole('button', { name: '+ Add item' })).toHaveCount(0);

  const sectionTitles = [
    'Getting started', 'Catalog', 'Editing an item', 'Selling an item',
    'Sync Queue', 'Import / Export', 'Scan Binder', 'Pricing settings',
    'The public binder page', 'Concepts & glossary', 'Known quirks',
  ];
  for (const title of sectionTitles) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
});

test('nav jump-links scroll to the matching section', async ({ page }) => {
  await page.goto('./?help=1');
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Known quirks' }).click();
  await expect(page).toHaveURL(/#known-quirks$/);
  await expect(page.locator('#known-quirks')).toBeVisible();
});
