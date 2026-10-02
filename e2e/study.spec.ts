import { ask, expect, pickTool, seed, test } from './fixtures';

test('practice test: take it, then practise the mistakes', async ({ app }) => {
  await pickTool(app, 'Create Practice Test');
  await ask(app, 'derivatives');
  await app.getByRole('button', { name: /Start test/ }).click();

  await app.getByRole('radio').first().click(); // Q1 right (A), the rest left blank
  await app.getByRole('button', { name: /Next/ }).click();
  await app.getByRole('button', { name: /Next/ }).click();
  await app.getByRole('button', { name: /Next/ }).click();
  await app.getByRole('button', { name: 'Submit test' }).click();
  await app.getByRole('button', { name: 'Submit', exact: true }).click();
  // (The chat underneath also shows "1/4" on the test card, so check the score ring's percentage.)
  await expect(app.getByText('25%', { exact: true })).toBeVisible();

  await app.getByRole('button', { name: /Practice mistakes/ }).click();
  await expect(app.getByText('Create a practice test on my mistakes in Derivatives')).toBeVisible();
});

test('flashcards are scheduled and come back under Review today', async ({ app }) => {
  await pickTool(app, 'Create Flashcards');
  await ask(app, 'trig identities');
  await app.getByRole('button', { name: /Study cards/ }).click();

  for (const answer of ['Got it', 'Still learning', 'Got it', 'Got it', 'Still learning', 'Got it']) {
    await app.getByRole('button', { name: answer, exact: true }).click();
  }
  await expect(app.getByText('You know 4 of 6')).toBeVisible();
  await expect(app.getByText('Next review today')).toBeVisible();

  await app.goBack();
  await app.getByRole('button', { name: 'Open menu' }).click();
  await app.getByRole('button', { name: /Review Trigonometric Identities, 2 cards due/ }).click();
  await expect(app.getByText('1 / 2')).toBeVisible();
});

test('lecture notes turn into flashcards', async ({ page }) => {
  const note = {
    id: 'n1',
    title: 'Derivatives and the Power Rule',
    createdAt: Date.now(),
    source: 'recording',
    transcript: 'Today we talk about derivatives.',
    notes: '# Derivatives and the Power Rule\n\n### Summary\nThe derivative is a slope.',
    status: 'done',
  };
  await seed(page, { kv: { 'note:index': ['n1'], 'note:n1': note } });
  await page.goto('/notes/n1');
  await page.getByRole('button', { name: 'Flashcards' }).click();
  await expect(page.getByText('Create flashcards from my lecture notes: Derivatives and the Power Rule')).toBeVisible();
  await expect(page.getByRole('button', { name: /Study cards/ })).toBeVisible();
});
