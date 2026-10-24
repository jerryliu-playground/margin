import { test as setup } from '@playwright/test';
import { ADMIN_STATE } from '../playwright.strapi.config';
import { signIn } from './helpers';

// One login for the whole run: Strapi rate-limits admin logins.
setup('sign in to the Strapi admin', async ({ page }) => {
  await signIn(page);
  await page.context().storageState({ path: ADMIN_STATE });
});
