import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.js on purpose — Playwright's own config also
// needs to import build settings without pulling in Vitest's test-only
// globals, and keeping them apart avoids the two ever fighting over the
// same `test` config key.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    exclude: ['node_modules', 'dist', 'e2e'],
  },
});
