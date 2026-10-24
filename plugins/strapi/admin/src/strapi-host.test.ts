import { describe, expect, it, vi } from 'vitest';
import type { StrapiField } from './fields';
import { createStrapiHost } from './strapi-host';

const fields: StrapiField[] = [
  { name: 'title', label: 'Title', kind: 'text', path: ['title'] },
  {
    name: 'seo.metaDescription',
    label: 'SEO › Meta description',
    kind: 'textarea',
    maxLength: 160,
    path: ['seo', 'metaDescription'],
  },
];

function setup(values: Record<string, unknown>) {
  const host = createStrapiHost({
    fields,
    bodyField: 'body',
    values,
    getAuthToken: async () => 'token',
  });
  const onChange = vi.fn();
  host.update(values, onChange);
  return { host, onChange };
}

describe('Strapi EditorHost', () => {
  it('describes its fields without Strapi paths', () => {
    const { host } = setup({});
    expect(host.getSchema()).toEqual([
      { name: 'title', label: 'Title', kind: 'text' },
      {
        name: 'seo.metaDescription',
        label: 'SEO › Meta description',
        kind: 'textarea',
        maxLength: 160,
      },
    ]);
  });

  it('reads the form values as agent state, body included', () => {
    const { host } = setup({
      title: 'Hi',
      seo: { metaTitle: 'T', metaDescription: null },
      body: [{ type: 'paragraph', children: [{ type: 'text', text: 'Long text.' }] }],
    });
    expect(host.getState()).toEqual({
      fields: { title: 'Hi', 'seo.metaDescription': '' },
      body: [{ blockId: 'b0', type: 'paragraph', text: 'Long text.' }],
    });
  });

  it('replaces one body block through onChange', async () => {
    const other = { type: 'heading', level: 2, children: [{ type: 'text', text: 'Keep' }] };
    const { host, onChange } = setup({
      body: [other, { type: 'paragraph', children: [{ type: 'text', text: 'Long text.' }] }],
    });
    await host.applyBodyEdit('b1', { type: 'paragraph', text: 'Short.' });
    expect(onChange).toHaveBeenCalledWith('body', [
      other,
      { type: 'paragraph', children: [{ type: 'text', text: 'Short.' }] },
    ]);
    expect(host.getState().body[1]?.text).toBe('Short.');
  });

  it('sets a top-level field through onChange', async () => {
    const { host, onChange } = setup({ title: 'Old' });
    await host.applyFieldValue('title', 'New');
    expect(onChange).toHaveBeenCalledWith('title', 'New');
    expect(host.getState().fields.title).toBe('New');
  });

  it('replaces the whole component for a component field, keeping its other values', async () => {
    const { host, onChange } = setup({ seo: { id: 3, metaTitle: 'T', metaDescription: '' } });
    await host.applyFieldValue('seo.metaDescription', 'A summary.');
    expect(onChange).toHaveBeenCalledWith('seo', {
      id: 3,
      metaTitle: 'T',
      metaDescription: 'A summary.',
    });
    // Current at once, before React passes the new values back.
    expect(host.getState().fields['seo.metaDescription']).toBe('A summary.');
  });

  it('creates the component when the entry has none yet', async () => {
    const { host, onChange } = setup({ seo: null });
    await host.applyFieldValue('seo.metaDescription', 'A summary.');
    expect(onChange).toHaveBeenCalledWith('seo', { metaDescription: 'A summary.' });
  });

  it('tells subscribers about changes from the form', () => {
    const { host, onChange } = setup({ title: 'A' });
    const seen: string[] = [];
    host.subscribe((s) => seen.push(String(s.fields.title)));
    host.update({ title: 'B' }, onChange);
    expect(seen).toEqual(['B']);
  });

  it('refuses unknown fields, lists, and blocks that do not exist', async () => {
    const { host } = setup({});
    await expect(host.applyFieldValue('price', '1')).rejects.toThrow(/no field "price"/);
    await expect(host.applyFieldValue('title', ['a'])).rejects.toThrow(/takes text/);
    await expect(host.applyBodyEdit('b0', { type: 'paragraph', text: 'x' })).rejects.toThrow(
      /No block/,
    );
  });

  it('has no body without a body field', async () => {
    const host = createStrapiHost({ fields, values: { body: [] }, getAuthToken: async () => '' });
    host.update({ body: [] }, vi.fn());
    expect(host.getState().body).toEqual([]);
    await expect(host.applyBodyEdit('b0', { type: 'paragraph', text: 'x' })).rejects.toThrow(
      /no body/,
    );
  });
});
