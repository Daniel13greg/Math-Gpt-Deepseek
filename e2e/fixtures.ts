import { test as base, expect, type Page } from '@playwright/test';

export interface Seed {
  settings?: Record<string, unknown>;
  /** Raw key-value storage entries (chats, notes, reviews…). */
  kv?: Record<string, unknown>;
}

/** Each test starts with an API key and the mock server as the API base URL. */
export async function seed(page: Page, data: Seed = {}) {
  await page.addInitScript((s: Seed) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('secure:deepseek_api_key', 'sk-e2e');
    localStorage.setItem('settings:v1', JSON.stringify({ version: 2, baseUrl: 'http://localhost:8787', ...s.settings }));
    for (const [key, value] of Object.entries(s.kv ?? {})) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }, data);
}

export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    await seed(page);
    await page.goto('/');
    await use(page);
  },
});

export { expect };

/** Types into the composer and sends. */
export async function ask(page: Page, text: string) {
  await page.getByLabel('Question', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}

export async function pickTool(page: Page, title: string) {
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByText(title, { exact: true }).click();
}
