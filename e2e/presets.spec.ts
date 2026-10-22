import { expect, test } from '@playwright/test';
import { createDocument, expectNoAxeViolations, panel } from './helpers';

const BODY = 'People scan web pages for answers. They leave when they cannot find them.';

test('a tone preset sends a request and the rewrite arrives as a proposal', async ({ page }) => {
  await createDocument(page, 'Scanning', BODY);
  const tone = panel(page).getByRole('group', { name: 'Tone' });
  await expectNoAxeViolations(page, 'aside');

  await tone.getByRole('button', { name: 'Shorter' }).click();
  await expect(panel(page).getByRole('log')).toContainText('Make the longest paragraph shorter.');
  const card = panel(page).getByRole('article', { name: 'Body edit' });
  await expect(card.getByRole('deletion')).toContainText('They leave');

  await card.getByRole('button', { name: 'Accept Body edit' }).click();
  await expect(page.getByRole('textbox', { name: 'Body' })).toHaveText(
    'People scan web pages for answers.',
  );
});
