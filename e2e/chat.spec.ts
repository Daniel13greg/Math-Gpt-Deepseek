import { ask, expect, pickTool, test } from './fixtures';

test('answers a question with Deep Think and titles the chat', async ({ app }) => {
  await ask(app, 'Solve x^2 - 5x + 6 = 0');
  await expect(app.getByText('Final answer:')).toBeVisible();
  await expect(app.getByText(/Thought for \d+s/)).toBeVisible();
  await expect(app.getByRole('button', { name: 'Save as PDF' })).toBeVisible();

  await app.getByRole('button', { name: 'Open menu' }).click();
  await expect(app.getByText('Solving x² − 5x + 6 = 0')).toBeVisible();
});

test('tutor mode gives a hint instead of the solution', async ({ app }) => {
  await app.getByRole('button', { name: 'Add photo or options' }).click();
  await app.getByText('Answer style', { exact: true }).click();
  await app.getByRole('radio', { name: /Tutor mode/ }).click();
  await expect(app.getByPlaceholder('Tutor mode: what are you working on?')).toBeVisible();

  await ask(app, 'Solve x^2 - 5x + 6 = 0');
  await expect(app.getByText('Try it, then tell me which two numbers you found.')).toBeVisible();
});

test('Check My Work points out the first mistake', async ({ app }) => {
  await pickTool(app, 'Check My Work');
  await ask(app, '2x + 3 = 11\n2x = 14\nx = 7');
  await expect(app.getByText('Work check')).toBeVisible();
  await expect(app.getByText(/First mistake in step 2/)).toBeVisible();
});

test('the math keyboard inserts LaTeX into the question', async ({ app }) => {
  await app.getByLabel('Question', { exact: true }).fill('Solve');
  await app.getByRole('button', { name: 'Math keyboard' }).click();
  // The field focuses itself, so a hardware keyboard works straight away.
  const field = app.locator('math-field');
  await expect.poll(() => field.evaluate((el) => (el as HTMLElement & { hasFocus(): boolean }).hasFocus())).toBe(true);
  await app.keyboard.type('x^2');
  await app.keyboard.press('ArrowRight');
  await app.keyboard.type('=4');
  await app.getByRole('button', { name: 'Insert' }).click();
  await expect(app.getByLabel('Question', { exact: true })).toHaveValue('Solve \\(x^2=4\\) ');
});

test('a photo with several problems asks which one to solve', async ({ app }) => {
  await app.getByRole('button', { name: 'Add photo or options' }).click();
  const chooser = app.waitForEvent('filechooser');
  await app.getByText('Choose from photos', { exact: true }).click();
  await (await chooser).setFiles('assets/images/icon.png');
  await expect(app.getByRole('button', { name: 'Remove image' })).toBeVisible();

  await app.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(app.getByText('Which problem should I solve?').first()).toBeVisible();
  await app.getByRole('button', { name: /Problem 2:/ }).click();
  await expect(app.getByText(/Solve problem 2: Find the vertex/)).toBeVisible();
  await expect(app.getByText('Final answer:')).toBeVisible();
});
