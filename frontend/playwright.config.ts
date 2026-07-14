import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for the AutoFlow storefront + admin panel.
 *
 * These specs assume the full stack is already running:
 *   • infra:    docker compose up -d postgres redis minio minio-init
 *   • backend:  npm run start:dev        (http://localhost:3000/api)
 *   • worker:   npm run start:worker:dev
 *   • frontend: npm run dev              (http://localhost:3001)
 *   • seed:     npm run seed             (creates admin@autoflow.example)
 *
 * Then: npm run test:e2e   (install browsers first: npx playwright install chromium)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
