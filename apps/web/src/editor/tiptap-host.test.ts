// @vitest-environment jsdom
import type { FieldDescriptor } from '@margin/shared';
import { Editor } from '@tiptap/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFieldStore } from './document-store';
import { editorExtensions } from './extensions';
import { createTipTapHost } from './tiptap-host';

const schema: FieldDescriptor[] = [
  { name: 'title', label: 'Title', kind: 'text', maxLength: 10 },
  { name: 'tags', label: 'Tags', kind: 'tags' },
];

let editor: Editor;
beforeEach(() => {
  editor = new Editor({
    extensions: editorExtensions,
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: 'Hi.' }] },
      ],
    },
  });
});
afterEach(() => editor.destroy());

const host = () =>
  createTipTapHost({
    editor,
    schema,
    fields: createFieldStore({ title: 'Old', tags: [] }),
    getAuthToken: () => Promise.resolve('t'),
  });

describe('TipTap EditorHost', () => {
  it('reports fields and body, with a stable state object between changes', () => {
    const h = host();
    expect(h.getState()).toEqual({
      fields: { title: 'Old', tags: [] },
      body: [{ blockId: 'p1', type: 'paragraph', text: 'Hi.' }],
    });
    expect(h.getState()).toBe(h.getState());
  });

  it('applies a field value and notifies subscribers', async () => {
    const h = host();
    const onChange = vi.fn();
    h.subscribe(onChange);
    await h.applyFieldValue('title', 'New');
    expect(h.getState().fields.title).toBe('New');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('applies a body edit and notifies subscribers', async () => {
    const h = host();
    const onChange = vi.fn();
    h.subscribe(onChange);
    await h.applyBodyEdit('p1', { type: 'paragraph', text: 'Hello.' });
    expect(h.getState().body[0]?.text).toBe('Hello.');
    expect(onChange).toHaveBeenCalled();
  });

  it('rejects unknown fields, wrong value kinds and over-long values', async () => {
    const h = host();
    await expect(h.applyFieldValue('slug', 'x')).rejects.toThrow(/Unknown field/);
    await expect(h.applyFieldValue('tags', 'x')).rejects.toThrow(/list of tags/);
    await expect(h.applyFieldValue('title', ['x'])).rejects.toThrow(/expects text/);
    await expect(h.applyFieldValue('title', 'x'.repeat(11))).rejects.toThrow(/at most 10/);
  });

  it('returns fresh state even when nobody is subscribed', async () => {
    const h = host();
    await h.applyFieldValue('title', 'Fresh');
    expect(h.getState().fields.title).toBe('Fresh');
    await h.applyBodyEdit('p1', { type: 'paragraph', text: 'Changed.' });
    expect(h.getState().body[0]?.text).toBe('Changed.');
  });

  it('stops listening when the last subscriber leaves', async () => {
    const h = host();
    const onChange = vi.fn();
    h.subscribe(onChange)();
    await h.applyFieldValue('title', 'New');
    expect(onChange).not.toHaveBeenCalled();
  });
});
