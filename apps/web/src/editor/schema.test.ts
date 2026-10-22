// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFieldStore } from './document-store';
import { editorExtensions } from './extensions';
import { DEMO_SCHEMA, SEO_LIMITS } from './schema';
import { createTipTapHost } from './tiptap-host';

let editor: Editor;
beforeEach(() => {
  editor = new Editor({ extensions: editorExtensions, content: { type: 'doc', content: [] } });
});
afterEach(() => editor.destroy());

const host = () =>
  createTipTapHost({
    editor,
    schema: DEMO_SCHEMA,
    fields: createFieldStore({ title: '', metaDescription: '' }),
    getAuthToken: () => Promise.resolve('t'),
  });

describe('DEMO_SCHEMA', () => {
  it('tells the agent the SEO limits: title 60, meta description 160', () => {
    const max = Object.fromEntries(DEMO_SCHEMA.map((f) => [f.name, f.maxLength]));
    expect(max.title).toBe(60);
    expect(max.metaDescription).toBe(160);
    expect(SEO_LIMITS).toEqual({ title: 60, metaDescription: 160 });
  });

  it('accepts a meta description at the limit and refuses one over it', async () => {
    const h = host();
    await h.applyFieldValue('metaDescription', 'x'.repeat(160));
    expect(h.getState().fields.metaDescription).toHaveLength(160);
    await expect(h.applyFieldValue('metaDescription', 'x'.repeat(161))).rejects.toThrow(
      /at most 160/,
    );
  });

  it('refuses a title over 60 characters', async () => {
    await expect(host().applyFieldValue('title', 'x'.repeat(61))).rejects.toThrow(/at most 60/);
  });
});
