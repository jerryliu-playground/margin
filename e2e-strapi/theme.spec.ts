import { expect, test } from '@playwright/test';
import {
  ask,
  createArticle,
  editUrl,
  expectPanelHasNoAxeViolations,
  hideGuidedTour,
  panel,
} from './helpers';

test("the panel follows Strapi's dark theme and stays accessible", async ({ page, request }) => {
  await hideGuidedTour(page);
  await page.addInitScript(() => localStorage.setItem('STRAPI_THEME', 'dark'));
  const id = await createArticle(request, {
    title: 'Scanning',
    paragraphs: ['Short. Then a longer one.'],
  });
  await page.goto(editUrl(id));

  // Strapi's dark surface, not the panel's own white default.
  await expect(panel(page)).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await ask(page, 'Write a meta description');
  await expect(panel(page).getByRole('article', { name: 'SEO › Meta description' })).toBeVisible();
  await expectPanelHasNoAxeViolations(page);
});
