import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests for pure frontend logic (no DOM / no running stack needed).
    // E2E lives under e2e/ and runs with Playwright against a live server.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
