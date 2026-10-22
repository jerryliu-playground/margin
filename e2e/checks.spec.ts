import { expect, test } from '@playwright/test';
import { ask, createDocument, expectNoAxeViolations, panel } from './helpers';

const SEED = '/#/documents/00000000-0000-4000-8000-000000000001';

test('accessibility check finds the image without alt and proposes alt text', async ({ page }) => {
  await page.goto(SEED);
  await ask(page, 'Check accessibility');

  const log = panel(page).getByRole('log');
  await expect(log).toContainText('Accessibility check');
  await expect(log.getByRole('listitem')).toContainText(['An image has no alt text.']);

  const card = panel(page).getByRole('article', { name: 'Image edit' });
  await expect(card.getByRole('insertion')).toContainText('Bar chart from the article');
  // A thumbnail of the current image and the alt text change, not raw Markdown.
  await expect(card.locator('img')).toHaveAttribute('src', '/sample-chart.svg');
  await expect(card).toContainText('Alt text');
  await expect(card).not.toContainText('](/sample-chart.svg)');
  await expectNoAxeViolations(page, 'aside');

  await card.getByRole('button', { name: 'Accept Image edit' }).click();
  await expect(page.getByRole('main').locator('img')).toHaveAttribute(
    'alt',
    'Bar chart from the article',
  );
});

test('SEO check reports a missing meta description and proposes one', async ({ page }) => {
  await createDocument(
    page,
    'Scanning the web',
    'People scan web pages for answers. They leave fast.',
  );
  await ask(page, 'Check SEO');

  await expect(panel(page).getByRole('log')).toContainText('SEO check');
  await expect(panel(page).getByRole('log')).toContainText('The article has no meta description.');
  await expect(panel(page).getByRole('article', { name: 'Meta description' })).toBeVisible();
});
