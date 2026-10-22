import {
  apiErrorSchema,
  authTokenResponseSchema,
  documentListResponseSchema,
  documentSchema,
  type DocumentContent,
  type DocumentSummary,
  type Document,
} from '@margin/shared';
import type { z } from 'zod';

export const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? 'http://localhost:8790';

let cached: { token: string; expiresAt: number } | undefined;

/** Short-lived token from our server (ADR 0006). Refreshed a minute before it expires. */
export async function getAuthToken(): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;
  const res = await fetch(`${AGENT_URL}/auth/token`, { method: 'POST' });
  const body = await readJson(res, authTokenResponseSchema);
  cached = { token: body.token, expiresAt: Date.parse(body.expiresAt) };
  return body.token;
}

async function readJson<S extends z.ZodType>(res: Response, schema: S): Promise<z.infer<S>> {
  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    throw new Error(parsed.success ? parsed.data.error.message : `Request failed (${res.status}).`);
  }
  return schema.parse(json);
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  init: { method?: string; body?: unknown } = {},
): Promise<z.infer<S>> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${await getAuthToken()}`,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  return readJson(res, schema);
}

export const api = {
  listDocuments: async (): Promise<DocumentSummary[]> =>
    (await request('/documents', documentListResponseSchema)).documents,
  createDocument: (): Promise<Document> =>
    request('/documents', documentSchema, { method: 'POST', body: {} }),
  getDocument: (id: string): Promise<Document> => request(`/documents/${id}`, documentSchema),
  saveDocument: (id: string, content: DocumentContent): Promise<Document> =>
    request(`/documents/${id}`, documentSchema, { method: 'PUT', body: content }),
};
