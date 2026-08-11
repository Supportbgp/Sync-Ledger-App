import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Playwright's E2E suite runs the real app (main.jsx/App.jsx/BinderView.jsx,
// unmodified) against a mocked Supabase client instead of the live backend —
// see src/test/harness/mockSupabaseClient.js and CLAUDE.md's testing section.
// `vite --mode harness` (only ever invoked by playwright.config.js) swaps in
// that mock via this alias; a normal `vite`/`vite build` never sets this mode,
// so production always gets the real src/lib/supabase.js.
export default defineConfig(({ mode }) => ({
  base: '/Sync-Ledger-App/',
  plugins: [react()],
  resolve: mode === 'harness' ? {
    // Exact-string aliases, not a regex — every relative form actually used
    // in the codebase (`./supabase.js`, `./lib/supabase.js`,
    // `../lib/supabase.js`) needs its own entry since @rollup/plugin-alias
    // matches the literal import specifier as written, not a resolved path.
    alias: ['./supabase.js', './lib/supabase.js', '../lib/supabase.js'].map((find) => ({
      find,
      replacement: fileURLToPath(new URL('./src/test/harness/mockSupabaseClient.js', import.meta.url)),
    })),
  } : undefined,
}));
