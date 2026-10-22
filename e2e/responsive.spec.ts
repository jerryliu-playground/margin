import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, panel } from './helpers';

const SEED = '/#/documents/00000000-0000-4000-8000-000000000001';

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the agent panel sits below the editor and nothing scrolls sideways', async ({ page }) => {
    await page.goto(SEED);
    const main = page.getByRole('main');
    await expect(panel(page)).toBeVisible();

    const mainBox = await main.boundingBox();
    const panelBox = await panel(page).boundingBox();
    expect(mainBox && panelBox && panelBox.y >= mainBox.y + mainBox.height - 1).toBe(true);

    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
    await expectNoAxeViolations(page, 'aside');
  });
});
