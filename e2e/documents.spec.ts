import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('create, edit, save and reload a document', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Documents' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Writing for the web' })).toBeVisible();

  await page.getByRole('button', { name: 'New document' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Untitled' })).toBeVisible();

  await page.getByLabel('Title').fill('E2E article');
  await page.getByLabel('Slug').fill('e2e-article');
  await page.getByLabel('Meta description').fill('A short test article.');
  await page.getByLabel('Tags').fill('testing, e2e');
  const body = page.getByRole('textbox', { name: 'Body' });
  await body.click();
  await page.keyboard.type('First paragraph.');
  await expect(page.getByRole('status')).toHaveText('Unsaved changes');

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');

  await page.reload();
  await expect(page.getByLabel('Title')).toHaveValue('E2E article');
  await expect(page.getByLabel('Tags')).toHaveValue('testing, e2e');
  await expect(body).toContainText('First paragraph.');
  // The agent panel sees the host's fields and blocks through EditorHost.
  await expect(page.getByRole('complementary', { name: 'Agent' })).toContainText(
    'Sees 5 fields and 1 blocks.',
  );

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
});

test('document list has no axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Writing for the web' })).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
});
