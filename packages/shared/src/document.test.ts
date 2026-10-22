import { describe, expect, it } from 'vitest';
import { DOCUMENT_LIMITS, EMPTY_BODY, documentContentSchema } from './document';

const valid = {
  title: 'Hello',
  slug: 'hello-world',
  summary: '',
  metaDescription: '',
  tags: ['a11y'],
  body: EMPTY_BODY,
};

describe('documentContentSchema', () => {
  it('accepts a valid document', () => {
    expect(documentContentSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an empty slug but rejects a malformed one', () => {
    expect(documentContentSchema.safeParse({ ...valid, slug: '' }).success).toBe(true);
    expect(documentContentSchema.safeParse({ ...valid, slug: 'Hello World' }).success).toBe(false);
    expect(documentContentSchema.safeParse({ ...valid, slug: 'a--b' }).success).toBe(false);
  });

  it('rejects a body that is not a TipTap doc', () => {
    expect(documentContentSchema.safeParse({ ...valid, body: { type: 'p' } }).success).toBe(false);
  });

  it('rejects a body over the size limit', () => {
    const text = 'x'.repeat(DOCUMENT_LIMITS.bodyBytes);
    const body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    };
    const result = documentContentSchema.safeParse({ ...valid, body });
    expect(result.success).toBe(false);
  });

  it('rejects too many tags', () => {
    const tags = Array.from({ length: DOCUMENT_LIMITS.tags + 1 }, (_, i) => `t${i}`);
    expect(documentContentSchema.safeParse({ ...valid, tags }).success).toBe(false);
  });
});
