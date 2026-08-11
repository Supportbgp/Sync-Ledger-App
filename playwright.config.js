import { defineConfig, devices } from '@playwright/test';

// Runs the real app (see src/test/harness/mockSupabaseClient.js for how
// Supabase gets swapped out) via `vite --mode harness` so tests exercise real
// CSS/layout in a real browser — the one thing Vitest+jsdom component tests
// can't verify. Chromium only: this environment ships one pre-installed
// browser, and desktop-vs-mobile viewport is what these specs care about, not
// cross-browser rendering differences.
const PORT = 5183;

// Some sandboxed dev environments (this one included) ship a single
// pre-installed Chromium revision at a fixed path instead of letting
// Playwright download its own matching revision — point at it directly only
// when that's actually the environment we're in. A normal CI runner (or any
// machine that ran `npx playwright install`) doesn't set this and downloads
// its own browser as usual.
const localChromiumPath = process.env.PLAYWRIGHT_BROWSERS_PATH === '/opt/pw-browsers'
  ? '/opt/pw-browsers/chromium'
  : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/Sync-Ledger-App/`,
    trace: 'retain-on-failure',
    launchOptions: localChromiumPath ? { executablePath: localChromiumPath } : {},
  },
  webServer: {
    command: `npx vite --mode harness --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'Desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile', use: { ...devices['Pixel 7'] } },
  ],
});
