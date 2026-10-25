import { expect, test } from '@playwright/test';
import {
  ask,
  blockText,
  createEntry,
  entryUrl,
  expectPanelHasNoAxeViolations,
  hideGuidedTour,
  panel,
  paragraphs,
  readEntry,
  type StoredArticle,
} from './helpers';

// Product is a content type no plugin config names (ADR 0011): the panel appears anyway,
// finds the fields in its SEO component, and edits its Blocks attribute, "description".
const PRODUCT = 'api::product.product';
const SHORT = 'Light shoes for long runs.';
const LONG = 'The upper is made of a thin mesh that dries fast after rain. It weighs very little.';

interface StoredProduct {
  seo: { metaDescription: string | null } | null;
  description: StoredArticle['body'];
}

test.beforeEach(async ({ page }) => {
  await hideGuidedTour(page);
});

test('a content type with no plugin config gets the panel, fields and body', async ({
  page,
  request,
}) => {
  const id = await createEntry(request, PRODUCT, {
    name: 'Trail runner',
    price: 89,
    description: paragraphs([SHORT, LONG]),
    seo: { metaTitle: '', metaDescription: '' },
  });
  await page.goto(entryUrl(PRODUCT, id));
  await expect(panel(page)).toBeVisible();

  await ask(page, 'Write a meta description');
  const meta = panel(page).getByRole('article', { name: 'SEO › Meta description' });
  await meta.getByRole('button', { name: 'Accept SEO › Meta description' }).click();
  await expect(page.getByRole('textbox', { name: 'metaDescription' })).toHaveValue(SHORT);

  await ask(page, 'Tighten the longest paragraph');
  const edit = panel(page).getByRole('article', { name: 'Body edit' });
  await expect(edit).toBeVisible();
  await expectPanelHasNoAxeViolations(page);
  await edit.getByRole('button', { name: 'Accept Body edit' }).click();
  await expect(edit).toContainText('Accepted');

  await page.getByRole('button', { name: 'Save' }).click();
  const tightened = 'The upper is made of a thin mesh that dries fast after rain.';
  await expect
    .poll(async () =>
      blockText((await readEntry<StoredProduct>(request, PRODUCT, id)).description, 1),
    )
    .toBe(tightened);
  const stored = await readEntry<StoredProduct>(request, PRODUCT, id);
  expect(stored.seo?.metaDescription).toBe(SHORT);
  expect(blockText(stored.description, 0)).toBe(SHORT);
});
