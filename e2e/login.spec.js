import { test, expect } from '@playwright/test';
import { seedHarness } from './fixtures.js';
import { HARNESS_PASSWORD } from '../src/test/harness/mockSupabaseClient.js';

test.beforeEach(async ({ page }) => {
  await seedHarness(page, { signedIn: false });
  await page.goto('./');
});

test('shows the shared-password sign-in form when no session exists', async ({ page }) => {
  await expect(page.getByText('Ledger sign-in')).toBeVisible();
  await expect(page.getByPlaceholder('Shared password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('shows an error and stays on the login screen for a wrong password', async ({ page }) => {
  await page.getByPlaceholder('Shared password').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect password.')).toBeVisible();
  await expect(page.getByText('Ledger sign-in')).toBeVisible();
});

test('signs in and reaches the catalog with the correct shared password', async ({ page }) => {
  await page.getByPlaceholder('Shared password').fill(HARNESS_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Ledger sign-in')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ Add item' })).toBeVisible();
});
