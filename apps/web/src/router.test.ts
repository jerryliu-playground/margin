import { describe, expect, it } from 'vitest';
import { parseRoute } from './router';

describe('parseRoute', () => {
  it('maps the empty and root hash to the list', () => {
    expect(parseRoute('')).toEqual({ name: 'list' });
    expect(parseRoute('#/')).toEqual({ name: 'list' });
  });

  it('reads a document id', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(parseRoute(`#/documents/${id}`)).toEqual({ name: 'document', id });
  });

  it('treats anything else as not found', () => {
    expect(parseRoute('#/documents/nope')).toEqual({ name: 'not-found' });
    expect(parseRoute('#/other')).toEqual({ name: 'not-found' });
  });
});
