import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SEED = '#/documents/00000000-0000-4000-8000-000000000001';

test('the agent streams a reply into the panel', async ({ page }) => {
  await page.goto(`/${SEED}`);
  const panel = page.getByRole('complementary', { name: 'Agent' });
  await panel.getByLabel('Message the agent').fill('Hello');
  await panel.getByRole('button', { name: 'Send' }).click();

  const log = panel.getByRole('log', { name: 'Conversation' });
  await expect(log).toContainText('Hello');
  await expect(log).toContainText('I can write a meta description');
  await expect(panel.getByRole('button', { name: 'Send' })).toBeEnabled();

  const axe = await new AxeBuilder({ page }).include('aside').analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
});
