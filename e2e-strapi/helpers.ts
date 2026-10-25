import AxeBuilder from '@axe-core/playwright';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { ADMIN } from '../playwright.strapi.config';

/** Switches Strapi's guided tour off, so it never covers the page. */
export async function hideGuidedTour(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'STRAPI_GUIDED_TOUR',
      JSON.stringify({ tours: {}, enabled: false, hidden: true, completedActions: [] }),
    );
  });
}

/** Signs in through the login page (once, in auth.setup.ts). */
export async function signIn(page: Page): Promise<void> {
  await hideGuidedTour(page);
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
  paragraphs: string[];
  /** Adds an image block without alt text (a media file record; the file need not exist). */
  image?: boolean;
}

export const IMAGE_URL = '/uploads/reading-time.png';

const imageBlock = {
  type: 'image',
  image: {
    name: 'reading-time.png',
    url: IMAGE_URL,
    alternativeText: null,
    width: 800,
    height: 400,
    hash: 'reading_time',
    ext: '.png',
    mime: 'image/png',
    size: 12.3,
    provider: 'local',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
  children: [{ type: 'text', text: '' }],
};

const collection = (uid: string) => `/content-manager/collection-types/${uid}`;

/** Paragraph blocks in Strapi's Blocks format. */
export const paragraphs = (texts: string[]) =>
  texts.map((text) => ({ type: 'paragraph', children: [{ type: 'text', text }] }));

/** Creates an entry of any content type through Strapi's admin API; returns its documentId. */
export async function createEntry(
  request: APIRequestContext,
  uid: string,
  data: Record<string, unknown>,
): Promise<string> {
  const headers = { authorization: `Bearer ${await adminToken(request)}` };
  const res = await request.post(collection(uid), { headers, data });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { data: { documentId: string } }).data.documentId;
}

/** The stored entry, as the Strapi admin API returns it. */
export async function readEntry<T>(
  request: APIRequestContext,
  uid: string,
  documentId: string,
): Promise<T> {
  const headers = { authorization: `Bearer ${await adminToken(request)}` };
  const res = await request.get(`${collection(uid)}/${documentId}`, { headers });
  return ((await res.json()) as { data: T }).data;
}

export const entryUrl = (uid: string, documentId: string) =>
  `/admin${collection(uid)}/${documentId}`;

/** Creates an article through Strapi's admin API, so each test owns its data. */
export function createArticle(request: APIRequestContext, data: ArticleData): Promise<string> {
  return createEntry(request, 'api::article.article', {
    title: data.title,
    seo: { metaTitle: '', metaDescription: '' },
    body: [...paragraphs(data.paragraphs), ...(data.image ? [imageBlock] : [])],
  });
}

export interface StoredArticle {
  seo: { metaDescription: string | null } | null;
  body: {
    type: string;
    children?: { text?: string }[];
    image?: { url: string; alternativeText: string | null };
  }[];
}

/** The stored article, as the Strapi admin API returns it. */
export function readArticle(
  request: APIRequestContext,
  documentId: string,
): Promise<StoredArticle> {
  return readEntry(request, 'api::article.article', documentId);
}

/** The plain text of a stored paragraph. */
export const paragraphText = (article: StoredArticle, index: number): string =>
  blockText(article.body, index);

/** The plain text of one stored block in a Blocks attribute. */
export const blockText = (blocks: StoredArticle['body'], index: number): string =>
  (blocks[index]?.children ?? []).map((c) => c.text ?? '').join('');

export function editUrl(documentId: string): string {
  return entryUrl('api::article.article', documentId);
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
