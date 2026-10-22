import { EMPTY_BODY, type Document } from '@margin/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bearer, testApp } from '../test-helpers';
import { SEED_DOCUMENT_ID } from './seed';

let app: FastifyInstance;
let auth: { authorization: string };

beforeEach(async () => {
  app = await testApp();
  auth = await bearer(app);
});
afterEach(() => app.close());

const content = {
  title: 'Draft',
  slug: 'draft',
  summary: 'S',
  metaDescription: 'M',
  tags: ['x'],
  body: EMPTY_BODY,
};

describe('/documents', () => {
  it('requires a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/documents' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'unauthorized' } });
  });

  it('lists the seeded article', async () => {
    const res = await app.inject({ method: 'GET', url: '/documents', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.json().documents).toEqual([
      expect.objectContaining({ id: SEED_DOCUMENT_ID, title: 'Writing for the web' }),
    ]);
  });

  it('creates with defaults, reads, and updates', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/documents',
      headers: auth,
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    const doc = created.json<Document>();
    expect(doc).toMatchObject({ title: '', tags: [], body: EMPTY_BODY });

    const updated = await app.inject({
      method: 'PUT',
      url: `/documents/${doc.id}`,
      headers: auth,
      payload: content,
    });
    expect(updated.statusCode).toBe(200);

    const read = await app.inject({ method: 'GET', url: `/documents/${doc.id}`, headers: auth });
    expect(read.json()).toMatchObject(content);
  });

  it('rejects an invalid update with a message naming the field', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/documents/${SEED_DOCUMENT_ID}`,
      headers: auth,
      payload: { ...content, slug: 'Not A Slug' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('slug');
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    const unknown = await app.inject({
      method: 'GET',
      url: '/documents/00000000-0000-4000-8000-0000000000ff',
      headers: auth,
    });
    expect(unknown.statusCode).toBe(404);
    const malformed = await app.inject({ method: 'GET', url: '/documents/nope', headers: auth });
    expect(malformed.statusCode).toBe(400);
  });
});
