import { describe, expect, it } from 'vitest';
import { humanize, readField, strapiFields, type StrapiSchema } from './fields';

const article: StrapiSchema = {
  attributes: {
    title: { type: 'string', maxLength: 120 },
    slug: { type: 'uid' },
    summary: { type: 'text' },
    body: { type: 'blocks' },
    cover: { type: 'media' },
    documentId: { type: 'string' },
    internalNote: { type: 'string', visible: false },
    createdAt: { type: 'datetime' },
    seo: { type: 'component', component: 'shared.seo', repeatable: false },
    faq: { type: 'component', component: 'shared.faq', repeatable: true },
  },
};
const components: Record<string, StrapiSchema> = {
  'shared.seo': {
    info: { displayName: 'SEO' },
    attributes: {
      metaTitle: { type: 'string', maxLength: 60 },
      metaDescription: { type: 'text', maxLength: 160 },
      documentId: { type: 'string' },
    },
  },
  'shared.faq': { attributes: { question: { type: 'string' } } },
};

describe('strapiFields', () => {
  it('maps text-like attributes and one level of single components', () => {
    expect(strapiFields(article, components, 'body')).toEqual([
      { name: 'title', label: 'Title', kind: 'text', maxLength: 120, path: ['title'] },
      { name: 'slug', label: 'Slug', kind: 'slug', path: ['slug'] },
      { name: 'summary', label: 'Summary', kind: 'textarea', path: ['summary'] },
      {
        name: 'seo.metaTitle',
        label: 'SEO › Meta title',
        kind: 'text',
        maxLength: 60,
        path: ['seo', 'metaTitle'],
      },
      {
        name: 'seo.metaDescription',
        label: 'SEO › Meta description',
        kind: 'textarea',
        maxLength: 160,
        path: ['seo', 'metaDescription'],
      },
    ]);
  });

  it('skips the configured body field even when it is text', () => {
    const names = strapiFields({ attributes: { content: { type: 'text' } } }, {}, 'content');
    expect(names).toEqual([]);
  });
});

describe('readField', () => {
  it('reads top-level and component values, empty for null', () => {
    const values = { title: 'Hi', seo: { metaDescription: null }, summary: null };
    expect(readField(values, ['title'])).toBe('Hi');
    expect(readField(values, ['summary'])).toBe('');
    expect(readField(values, ['seo', 'metaDescription'])).toBe('');
    expect(readField({ seo: null }, ['seo', 'metaTitle'])).toBe('');
  });
});

describe('humanize', () => {
  it('turns attribute names into labels', () => {
    expect(humanize('metaDescription')).toBe('Meta description');
    expect(humanize('cover_image')).toBe('Cover image');
  });
});
