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
    {
      // The key-holding proxy in front of the mock, for e2e/proxy.spec.ts.
      command: 'node server/proxy.mjs',
      port: 8788,
      env: {
        DEEPSEEK_API_KEY: 'sk-mock',
        APP_TOKENS: 'e2e-app-token',
        UPSTREAM_URL: 'http://localhost:8787',
        PORT: '8788',
        HOST: '127.0.0.1',
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
