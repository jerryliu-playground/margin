import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('app shell loads with the agent panel and no axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Margin' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Agent' })).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
});

test('agent server is up with the mock model', async ({ request }) => {
  const res = await request.get('http://127.0.0.1:8787/health');
  expect(res.ok()).toBe(true);
});
