import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit tests always run against the reference theme. Both halves of what next.config.mjs
// decides at build time are pinned from this one id — the folder behind `@theme` and the
// inlined STOREFRONT_THEME — so a STOREFRONT_THEME exported by the shell (the release
// workflow sets the client's theme for its build) can neither change test results nor
// trip the mismatch check in themes/built-theme.ts. The per-theme guards read every theme
// folder from disk; the client's own bundle is verified by `next build`.
const testThemeId = 'current';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@theme': fileURLToPath(new URL(`./src/themes/${testThemeId}`, import.meta.url)),
    },
  },
  test: {
    // Unit tests for pure frontend logic (no DOM / no running stack needed).
    // E2E lives under e2e/ and runs with Playwright against a live server.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: { STOREFRONT_THEME: testThemeId },
  },
});
