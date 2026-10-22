import { expect, test, type Locator, type Page } from '@playwright/test';
import { ask, createDocument, expectNoAxeViolations, field, panel } from './helpers';

const BODY = 'People scan web pages for answers. They leave when they cannot find them.';

/** Presses a key until `target` has focus, so the test proves it is reachable by keyboard. */
async function tabTo(
  page: Page,
  target: Locator,
  key: 'Tab' | 'Shift+Tab',
  max = 30,
): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

test.describe('axe on every screen', () => {
  test('document list', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Writing for the web' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('page not found', async ({ page }) => {
    await page.goto('/#/nowhere');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('editor with check results and every card state', async ({ page }) => {
    await createDocument(page, 'Scanning', BODY);
    await expectNoAxeViolations(page);

    // Check results in the conversation.
    await ask(page, 'Check SEO');
    const meta = panel(page).getByRole('article', { name: 'Meta description' });
    await expect(meta).toBeVisible();
    await expectNoAxeViolations(page); // pending
    await meta.getByRole('button', { name: 'Accept Meta description' }).click();
    await expect(meta).toContainText('Accepted');
    await expectNoAxeViolations(page); // accepted
    await meta.getByRole('button', { name: 'Undo Meta description' }).click();
    await expect(meta).toContainText('Undone');
    await expectNoAxeViolations(page); // undone

    await ask(page, 'Suggest a title and tags');
    const title = panel(page).getByRole('article', { name: 'Title' });
    await title.getByRole('button', { name: 'Reject Title' }).click();
    await expect(title).toContainText('Rejected');
    await panel(page)
      .getByRole('article', { name: 'Tags' })
      .getByRole('button', { name: 'Reject Tags' })
      .click();
    await expectNoAxeViolations(page); // rejected

    await ask(page, 'Tighten the longest paragraph');
    const edit = panel(page).getByRole('article', { name: 'Body edit' });
    await expect(edit).toBeVisible();
    const body = page.getByRole('textbox', { name: 'Body' });
    await body.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' More.');
    await expect(edit.getByRole('alert')).toContainText('can no longer be applied');
    await expectNoAxeViolations(page); // outdated
  });
});

test('the whole proposal flow works with the keyboard alone', async ({ page }) => {
  await createDocument(page, 'Scanning', BODY);

  const input = panel(page).getByLabel('Message the agent');
  await tabTo(page, input, 'Tab');
  await page.keyboard.type('Write a meta description');
  await page.keyboard.press('Enter');

  const card = panel(page).getByRole('article', { name: 'Meta description' });
  await expect(card).toBeVisible();
  // Announced through the panel's live status line.
  await expect(panel(page).getByRole('status')).toHaveText('1 proposal to review.');
  const accept = card.getByRole('button', { name: 'Accept Meta description' });
  await tabTo(page, accept, 'Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(field(page, 'Meta description')).toHaveValue(BODY);
  await expect(input).toBeFocused();
  await expect(panel(page).getByRole('status')).not.toHaveText('1 proposal to review.');

  const undo = card.getByRole('button', { name: 'Undo Meta description' });
  await tabTo(page, undo, 'Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(field(page, 'Meta description')).toHaveValue('');
  await expect(input).toBeFocused();
});
