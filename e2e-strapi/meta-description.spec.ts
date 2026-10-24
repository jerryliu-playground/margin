import { expect, test } from '@playwright/test';
import {
  ask,
  createArticle,
  editUrl,
  expectPanelHasNoAxeViolations,
  panel,
  readArticle,
  hideGuidedTour,
} from './helpers';

const PARAGRAPH = 'People scan web pages for answers. They leave when they cannot find them.';
const CARD = 'SEO › Meta description';
// The mock model writes the meta description from the first paragraph.
const META = PARAGRAPH;

test.beforeEach(async ({ page }) => {
  await hideGuidedTour(page);
});

test('accept a meta description in Strapi; it is saved on the entry', async ({ page, request }) => {
  const id = await createArticle(request, { title: 'Scanning', paragraphs: [PARAGRAPH] });
  await page.goto(editUrl(id));

  await ask(page, 'Write a meta description');
  const card = panel(page).getByRole('article', { name: CARD });
  await expect(card).toBeVisible();
  await expectPanelHasNoAxeViolations(page);

  await card.getByRole('button', { name: `Accept ${CARD}` }).click();
  await expect(card).toContainText('Accepted');
  await expect(panel(page).getByLabel('Message the agent')).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'metaDescription' })).toHaveValue(META);
  await expectPanelHasNoAxeViolations(page);

  // Accept changes the form only; saving stays with Strapi.
  expect((await readArticle(request, id)).seo?.metaDescription ?? '').toBe('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await readArticle(request, id)).seo?.metaDescription).toBe(META);
  // Strapi re-renders the edit view after saving; the conversation stays.
  await expect(card).toContainText('Accepted');
});

test('reject a meta description in Strapi; nothing changes', async ({ page, request }) => {
  const id = await createArticle(request, { title: 'Scanning', paragraphs: [PARAGRAPH] });
  await page.goto(editUrl(id));

  await ask(page, 'Write a meta description');
  const card = panel(page).getByRole('article', { name: CARD });
  await card.getByRole('button', { name: `Reject ${CARD}` }).click();
  await expect(card).toContainText('Rejected');
  await expect(page.getByRole('textbox', { name: 'metaDescription' })).toHaveValue('');
});
