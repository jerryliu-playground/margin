import { expect, test } from '@playwright/test';
import { ask, createDocument, expectNoAxeViolations, field, panel, save } from './helpers';

const BODY = 'People scan web pages for answers. They leave when they cannot find them.';

test('accept a meta description proposal and save it', async ({ page }) => {
  await createDocument(page, 'Scanning', BODY);
  await ask(page, 'Write a meta description');

  const card = panel(page).getByRole('article', { name: 'Meta description' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Summarises the opening');
  await expect(card.getByRole('insertion')).toContainText('People scan web pages');
  await expectNoAxeViolations(page);

  await card.getByRole('button', { name: 'Accept Meta description' }).click();
  await expect(field(page, 'Meta description')).toHaveValue(BODY);
  await expect(card).toContainText('Accepted');
  // No pending proposal is left, so focus moves to the message box.
  await expect(panel(page).getByLabel('Message the agent')).toBeFocused();
  await expect(panel(page).getByRole('log')).toContainText('Save the document to keep the change.');

  await save(page);
  await page.reload();
  await expect(field(page, 'Meta description')).toHaveValue(BODY);
});

test('undo an accepted proposal restores the previous value', async ({ page }) => {
  await createDocument(page, 'Scanning', BODY);
  await ask(page, 'Write a meta description');
  const card = panel(page).getByRole('article', { name: 'Meta description' });
  await card.getByRole('button', { name: 'Accept Meta description' }).click();
  await expect(field(page, 'Meta description')).toHaveValue(BODY);

  await card.getByRole('button', { name: 'Undo Meta description' }).click();
  await expect(field(page, 'Meta description')).toHaveValue('');
  await expect(card).toContainText('Undone.');
  await expect(card.getByRole('button', { name: /Undo/ })).toHaveCount(0);
  await expect(panel(page).getByLabel('Message the agent')).toBeFocused();
});

test('after an undo, the agent is told and works from the current document', async ({ page }) => {
  await createDocument(page, 'Scanning', BODY);
  await ask(page, 'Write a meta description');
  const card = panel(page).getByRole('article', { name: 'Meta description' });
  await card.getByRole('button', { name: 'Accept Meta description' }).click();
  await card.getByRole('button', { name: 'Undo Meta description' }).click();
  await expect(card).toContainText('Undone.');

  await ask(page, 'Hello');
  await expect(panel(page).getByRole('log')).toContainText('I see you undid my last change');
});

test('undo is refused after the block was edited again', async ({ page }) => {
  await createDocument(page, 'Scanning', BODY);
  await ask(page, 'Tighten the longest paragraph');
  const card = panel(page).getByRole('article', { name: 'Body edit' });
  await card.getByRole('button', { name: 'Accept Body edit' }).click();

  const body = page.getByRole('textbox', { name: 'Body' });
  await expect(body).toHaveText('People scan web pages for answers.');
  await body.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Edited.');
  await card.getByRole('button', { name: 'Undo Body edit' }).click();

  await expect(card.getByRole('alert')).toContainText('can no longer be undone');
  await expect(body).toHaveText('People scan web pages for answers. Edited.');
});

test('reject a proposal with a reason and nothing changes', async ({ page }) => {
  await createDocument(page, 'Scanning', BODY);
  await ask(page, 'Write a meta description');

  const card = panel(page).getByRole('article', { name: 'Meta description' });
  await card.getByLabel('Reason for rejecting (optional)').fill('Too long');
  await card.getByRole('button', { name: 'Reject Meta description' }).click();

  await expect(card).toContainText('Rejected.');
  await expect(panel(page).getByRole('log')).toContainText('Noted: Too long');
  await expect(field(page, 'Meta description')).toHaveValue('');
  // Still "Saved": rejecting changed nothing in the document.
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Saved');

  await page.reload();
  await expect(field(page, 'Meta description')).toHaveValue('');
});

test('accept a body edit; it replaces only that block', async ({ page }) => {
  await createDocument(page, 'Scanning', BODY);
  await ask(page, 'Tighten the longest paragraph');

  const card = panel(page).getByRole('article', { name: 'Body edit' });
  await expect(card.getByRole('deletion')).toContainText('They leave');
  await card.getByRole('button', { name: 'Accept Body edit' }).click();

  const body = page.getByRole('textbox', { name: 'Body' });
  await expect(body).toHaveText('People scan web pages for answers.');
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Unsaved changes');
});

test('accept all applies every pending proposal', async ({ page }) => {
  await createDocument(page, 'A title that is fine', BODY);
  await ask(page, 'Suggest a title and tags');
  const batch = panel(page).getByRole('group', { name: 'All pending proposals' });
  await batch.getByRole('button', { name: 'Accept all 2' }).click();

  await expect(field(page, 'Tags')).toHaveValue('writing, web, style');
  await expect(panel(page).getByRole('article', { name: 'Title' })).toContainText('Accepted');
  await expect(batch).toHaveCount(0);
  await expect(panel(page).getByLabel('Message the agent')).toBeFocused();
});

test('two proposals in one turn: focus moves to the next card', async ({ page }) => {
  await createDocument(page, 'A title that is fine', BODY);
  await ask(page, 'Suggest a title and tags');

  const title = panel(page).getByRole('article', { name: 'Title' });
  const tags = panel(page).getByRole('article', { name: 'Tags' });
  await title.getByRole('button', { name: 'Reject Title' }).click();
  await expect(tags.getByRole('button', { name: 'Accept Tags' })).toBeFocused();
  await tags.getByRole('button', { name: 'Accept Tags' }).click();
  await expect(field(page, 'Tags')).toHaveValue('writing, web, style');
  await expect(field(page, 'Title')).toHaveValue('A title that is fine');
});
