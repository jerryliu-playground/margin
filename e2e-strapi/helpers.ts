import AxeBuilder from '@axe-core/playwright';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { ADMIN } from '../playwright.strapi.config';

const ARTICLES = '/content-manager/collection-types/api::article.article';

/** Signs in to the Strapi admin with the guided tour switched off. */
export async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'STRAPI_GUIDED_TOUR',
      JSON.stringify({ tours: {}, enabled: false, hidden: true, completedActions: [] }),
    );
  });
  await page.goto('/admin/auth/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(ADMIN.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).not.toHaveURL(/auth\/login/);
}

let token: Promise<string> | undefined;

/** One admin API login per worker: Strapi rate-limits /admin/login. */
function adminToken(request: APIRequestContext): Promise<string> {
  token ??= request.post('/admin/login', { data: ADMIN }).then(async (res) => {
    expect(res.ok(), await res.text()).toBe(true);
    return ((await res.json()) as { data: { token: string } }).data.token;
  });
  return token;
}

export interface ArticleData {
  title: string;
  paragraph: string;
}

/** Creates an article through Strapi's admin API, so each test owns its data. */
export async function createArticle(
  request: APIRequestContext,
  data: ArticleData,
): Promise<string> {
  const headers = { authorization: `Bearer ${await adminToken(request)}` };
  const res = await request.post(ARTICLES, {
    headers,
    data: {
      title: data.title,
      seo: { metaTitle: '', metaDescription: '' },
      body: [{ type: 'paragraph', children: [{ type: 'text', text: data.paragraph }] }],
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { data: { documentId: string } }).data.documentId;
}

/** The stored article, as the Strapi admin API returns it. */
export async function readArticle(
  request: APIRequestContext,
  documentId: string,
): Promise<{ seo: { metaDescription: string | null } | null }> {
  const headers = { authorization: `Bearer ${await adminToken(request)}` };
  const res = await request.get(`${ARTICLES}/${documentId}`, { headers });
  return ((await res.json()) as { data: { seo: { metaDescription: string | null } | null } }).data;
}

export function editUrl(documentId: string): string {
  return `/admin${ARTICLES}/${documentId}`;
}

/** The Margin agent panel inside Strapi's side panel. */
export function panel(page: Page) {
  return page.getByRole('complementary', { name: 'Agent' });
}

export async function ask(page: Page, message: string): Promise<void> {
  await panel(page).getByLabel('Message the agent').fill(message);
  await panel(page).getByRole('button', { name: 'Send' }).click();
}

/** axe on the agent panel only: Strapi's own admin is not ours to fix. */
export async function expectPanelHasNoAxeViolations(page: Page): Promise<void> {
  const axe = await new AxeBuilder({ page }).include('.margin-panel').analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
}
