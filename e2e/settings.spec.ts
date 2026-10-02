import { ask, expect, seed, test } from './fixtures';

test('switching the language translates the app', async ({ app }) => {
  await app.goto('/settings');
  await app.getByRole('button', { name: 'Español' }).click();
  await expect(app.getByText('Ajustes').first()).toBeVisible();
  await app.goto('/');
  await expect(app.getByPlaceholder('Escribe tu pregunta de matemáticas')).toBeVisible();
  await expect(app.getByRole('button', { name: 'Herramientas', exact: true })).toBeVisible();
});

test('a backup restores chats on a fresh device', async ({ app, browser }) => {
  await ask(app, 'Solve x^2 - 5x + 6 = 0');
  await expect(app.getByText('Final answer:')).toBeVisible();
  await app.goto('/settings');
  const download = app.waitForEvent('download');
  await app.getByText('Back up to a file').click();
  const file = await (await download).path();

  const fresh = await browser.newPage();
  await seed(fresh);
  await fresh.goto('/settings');
  const chooser = fresh.waitForEvent('filechooser');
  await fresh.getByText('Restore from a backup').click();
  await (await chooser).setFiles(file);
  await expect(fresh.getByText('Restored 1 chat.')).toBeVisible();
  await fresh.goto('/');
  await fresh.getByRole('button', { name: 'Open menu' }).click();
  await expect(fresh.getByText('Solving x² − 5x + 6 = 0')).toBeVisible();
});

test('usage is counted per chat', async ({ app }) => {
  await ask(app, 'Solve x^2 - 5x + 6 = 0');
  await expect(app.getByText('Final answer:')).toBeVisible();
  await app.goto('/settings');
  await expect(app.getByText(/2 requests/).first()).toBeVisible();
});
