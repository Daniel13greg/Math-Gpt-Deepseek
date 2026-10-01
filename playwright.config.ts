import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests of the web build against the mock DeepSeek server (no API key needed).
 * Run `npm run e2e` (it exports the web build first).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:8090',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/mock-deepseek.mjs',
      port: 8787,
      env: { MOCK_DELAY_MS: '1', PORT: '8787' },
      reuseExistingServer: !process.env.CI,
    },
    { command: 'node e2e/serve.mjs', port: 8090, reuseExistingServer: !process.env.CI },
  ],
});
