import { expect, test } from '@playwright/test';
import {
  ask,
  createArticle,
  editUrl,
  expectPanelHasNoAxeViolations,
  IMAGE_URL,
  panel,
  paragraphText,
  readArticle,
  hideGuidedTour,
} from './helpers';

const SHORT = 'People scan web pages.';
const LONG =
  'In order to make sure that readers find what they are looking for, keep your sentences short. Long ones lose them.';

test.beforeEach(async ({ page }) => {
  await hideGuidedTour(page);
});

test('accept a body edit in Strapi; only that block changes and it is saved', async ({
  page,
  request,
}) => {
  const id = await createArticle(request, { title: 'Scanning', paragraphs: [SHORT, LONG] });
  await page.goto(editUrl(id));

  await ask(page, 'Tighten the longest paragraph');
  const card = panel(page).getByRole('article', { name: 'Body edit' });
  await expect(card).toBeVisible();
  await expectPanelHasNoAxeViolations(page);
  await card.getByRole('button', { name: 'Accept Body edit' }).click();
  await expect(card).toContainText('Accepted');

  const tightened =
    'In order to make sure that readers find what they are looking for, keep your sentences short.';
  // In Strapi's editor, not in the card's diff.
  await expect(page.getByRole('textbox').getByText(tightened, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => paragraphText(await readArticle(request, id), 1)).toBe(tightened);
  expect(paragraphText(await readArticle(request, id), 0)).toBe(SHORT);
});

test('accessibility check proposes alt text for an image; accepting saves it', async ({
  page,
  request,
}) => {
  const id = await createArticle(request, { title: 'Scanning', paragraphs: [SHORT], image: true });
  await page.goto(editUrl(id));

  await ask(page, 'Check accessibility');
  await expect(panel(page).getByText('Accessibility check')).toBeVisible();
  const card = panel(page).getByRole('article', { name: 'Image edit' });
  await expect(card).toContainText('Alt text');
  await expectPanelHasNoAxeViolations(page);
  await card.getByRole('button', { name: 'Accept Image edit' }).click();
  await expect(card).toContainText('Accepted');

  await page.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await readArticle(request, id)).body[1]?.image?.alternativeText)
    .toBe('Bar chart from the article');
  // Only the alt text changed; the media file is the same.
  expect((await readArticle(request, id)).body[1]?.image?.url).toBe(IMAGE_URL);
});
