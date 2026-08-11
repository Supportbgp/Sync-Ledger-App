import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// @testing-library/react's auto-cleanup only self-registers when it detects
// globals (globalThis.afterEach) — this project imports test functions
// explicitly instead of using Vitest's `globals: true`, so without this
// every test's rendered output would stay mounted and leak into the next
// test's queries within the same file.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia — useIsMobile (hooks/useIsMobile.js)
// calls it unconditionally, so every component test that renders anything
// using that hook needs a stub, not just the ones testing mobile behavior
// directly. Defaults to "not matched" (desktop) unless a test overrides it.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
