import { describe, expect, it } from 'vitest';
import { testRequest } from '../testing/test-request';
import { scriptedReply } from './mock-model';

describe('mock model', () => {
  it("proposes the host's own meta description field (Strapi: seo.metaDescription)", () => {
    const request = testRequest([{ id: 'u1', role: 'user', content: 'Write a meta description' }]);
    request.state.schema = [
      { name: 'title', label: 'Title', kind: 'text' },
      { name: 'seo.metaDescription', label: 'SEO › Meta description', kind: 'textarea' },
    ];
    const reply = scriptedReply(request);
    expect(reply.calls?.[0]).toMatchObject({
      name: 'proposeFieldValue',
      args: { field: 'seo.metaDescription' },
    });
  });

  it('keeps the plain field name in the demo', () => {
    const request = testRequest([{ id: 'u1', role: 'user', content: 'Write a meta description' }]);
    expect(scriptedReply(request).calls?.[0]).toMatchObject({ args: { field: 'metaDescription' } });
  });
});
