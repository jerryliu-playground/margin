// @vitest-environment jsdom
import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockError, replaceBlock, toBodyBlocks } from './blocks';
import { editorExtensions } from './extensions';

const doc: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { id: 'h1', level: 2 }, content: [{ type: 'text', text: 'Title' }] },
    {
      type: 'paragraph',
      attrs: { id: 'p1' },
      content: [
        { type: 'text', text: 'Some ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' text.' },
      ],
    },
    {
      type: 'bulletList',
      attrs: { id: 'l1' },
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }],
        },
      ],
    },
  ],
};

let editor: Editor;
/** TipTap emits `create` (where UniqueID fills missing ids) on the next tick. */
const make = async (content: JSONContent = doc) => {
  const element = document.createElement('div');
  document.body.append(element);
  editor = new Editor({ element, extensions: editorExtensions, content });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return editor;
};
afterEach(() => editor.destroy());

describe('toBodyBlocks', () => {
  it('exposes top-level blocks with ids, Markdown text and attrs', async () => {
    expect(toBodyBlocks(await make())).toEqual([
      { blockId: 'h1', type: 'heading', text: 'Title', attrs: { level: 2 } },
      { blockId: 'p1', type: 'paragraph', text: 'Some **bold** text.' },
      { blockId: 'l1', type: 'bulletList', text: '- One\n- Two' },
    ]);
  });

  it('gives every block an id, even content saved without one', async () => {
    await make({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    });
    const [block] = toBodyBlocks(editor);
    expect(block?.blockId).toMatch(/.+/);
  });
});

describe('replaceBlock', () => {
  it('replaces one paragraph, keeps its id and parses inline Markdown', async () => {
    await make();
    replaceBlock(editor, 'p1', { type: 'paragraph', text: 'Now *italic*.' });
    const blocks = toBodyBlocks(editor);
    expect(blocks[1]).toEqual({ blockId: 'p1', type: 'paragraph', text: 'Now *italic*.' });
    expect(blocks.map((b) => b.blockId)).toEqual(['h1', 'p1', 'l1']);
  });

  it('can turn a paragraph into a heading', async () => {
    await make();
    replaceBlock(editor, 'p1', { type: 'heading', text: 'Promoted', attrs: { level: 3 } });
    expect(toBodyBlocks(editor)[1]).toEqual({
      blockId: 'p1',
      type: 'heading',
      text: 'Promoted',
      attrs: { level: 3 },
    });
  });

  it('replaces a list from Markdown', async () => {
    await make();
    replaceBlock(editor, 'l1', { type: 'bulletList', text: '- A\n- B\n- C' });
    expect(toBodyBlocks(editor)[2]).toEqual({
      blockId: 'l1',
      type: 'bulletList',
      text: '- A\n- B\n- C',
    });
  });

  it('is undone by a single undo', async () => {
    await make();
    const before = toBodyBlocks(editor);
    replaceBlock(editor, 'p1', { type: 'paragraph', text: 'Changed.' });
    editor.commands.undo();
    expect(toBodyBlocks(editor)).toEqual(before);
  });

  it('refuses unknown ids, unknown types and multi-block content', async () => {
    await make();
    expect(() => replaceBlock(editor, 'nope', { type: 'paragraph', text: 'x' })).toThrow(
      BlockError,
    );
    expect(() => replaceBlock(editor, 'p1', { type: 'table', text: 'x' })).toThrow(
      /Unknown block type/,
    );
    expect(() => replaceBlock(editor, 'p1', { type: 'paragraph', text: 'One.\n\nTwo.' })).toThrow(
      /single block/,
    );
  });
});

describe('UniqueID', () => {
  it('keeps ids unique when the same block is pasted twice', async () => {
    // jsdom has no ClipboardEvent or layout; ProseMirror only needs these to exist.
    globalThis.ClipboardEvent ??= class extends Event {} as unknown as typeof ClipboardEvent;
    const noRects = () => [] as unknown as DOMRectList;
    Element.prototype.getClientRects ??= noRects;
    Range.prototype.getClientRects ??= noRects;
    Range.prototype.getBoundingClientRect ??= () => new DOMRect();

    await make({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: 'Copy me.' }] },
        { type: 'paragraph', attrs: { id: 'p2' } },
      ],
    });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1); // inside the empty p2
    const copied = '<p data-id="p1">Copy me.</p>';
    // Pasting three blocks keeps the middle one whole, with its copied id.
    editor.view.pasteHTML(copied + copied + copied);
    editor.view.pasteHTML(copied + copied + copied);

    const ids = toBodyBlocks(editor).map((b) => b.blockId);
    expect(ids.length).toBeGreaterThan(2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('p1');
  });

  it('keeps ids through a JSON save and load', async () => {
    await make();
    const saved = editor.getJSON();
    editor.destroy();
    await make(saved);
    expect(toBodyBlocks(editor).map((b) => b.blockId)).toEqual(['h1', 'p1', 'l1']);
  });
});
