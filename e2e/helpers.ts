import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Creates and saves a fresh document through the UI, so each test owns its data. */
export async function createDocument(page: Page, title: string, body: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New document' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Untitled' })).toBeVisible();
  await field(page, 'Title').fill(title);
  await page.getByRole('textbox', { name: 'Body' }).click();
  await page.keyboard.type(body);
  await save(page);
}

export async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Saved');
}

/** A document field in the editor form (cards in the panel reuse the same labels). */
export function field(page: Page, label: string) {
  return page.getByRole('main').getByLabel(label);
}

export function panel(page: Page) {
  return page.getByRole('complementary', { name: 'Agent' });
}

export async function ask(page: Page, message: string): Promise<void> {
  await panel(page).getByLabel('Message the agent').fill(message);
  await panel(page).getByRole('button', { name: 'Send' }).click();
}

export async function expectNoAxeViolations(page: Page): Promise<void> {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
}
