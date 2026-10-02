import { ask, expect, seed, test } from './fixtures';

// The web app talking to server/proxy.mjs (which holds the real API key) instead of the model API directly.
const PROXY = 'http://localhost:8788';

test('chats through the key-holding proxy with an app token', async ({ page }) => {
  await seed(page, { apiKey: 'e2e-app-token', settings: { baseUrl: PROXY } });
  await page.goto('/');
  await ask(page, 'Solve x^2 - 5x + 6 = 0');
  await expect(page.getByText('Final answer:')).toBeVisible();
  await expect(page.getByText(/Thought for \d+s/)).toBeVisible();
});

test('a wrong app token is reported as an invalid key', async ({ page }) => {
  await seed(page, { apiKey: 'wrong-token', settings: { baseUrl: PROXY } });
  await page.goto('/');
  await ask(page, 'Solve x^2 - 5x + 6 = 0');
  await expect(page.getByText(/API key was rejected/).first()).toBeVisible();
});
