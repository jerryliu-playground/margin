import type { BodyBlock, BodyBlockContent } from '@margin/shared';
import type { Editor, JSONContent } from '@tiptap/core';

/**
 * Conversion between TipTap's document and the host-neutral body (ADR 0006).
 * Paragraphs and headings expose their inline content as Markdown, with the heading level in
 * `attrs`. Other blocks (lists, quotes, code) expose their whole Markdown, block syntax included.
 */
const INLINE_BLOCKS = new Set(['paragraph', 'heading']);

function markdown(editor: Editor) {
  const manager = editor.markdown;
  if (!manager) throw new Error('The Markdown extension is missing from editorExtensions.');
  return manager;
}

export function toBodyBlocks(editor: Editor): BodyBlock[] {
  const md = markdown(editor);
  const blocks: BodyBlock[] = [];
  editor.state.doc.forEach((node) => {
    const json = node.toJSON() as JSONContent;
    const { id, ...rest } = (json.attrs ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string') return; // UniqueID assigns ids on every transaction.
    const inline = INLINE_BLOCKS.has(node.type.name);
    const text = inline
      ? md.serialize({ type: 'doc', content: [{ type: 'paragraph', content: json.content ?? [] }] })
      : md.serialize({ type: 'doc', content: [json] });
    const attrs = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null));
    blocks.push({
      blockId: id,
      type: node.type.name,
      text: text.trim(),
      ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    });
  });
  return blocks;
}

export class BlockError extends Error {}

/** Builds the TipTap node for a proposed block, keeping the block's id. */
export function fromBodyBlock(
  editor: Editor,
  blockId: string,
  block: BodyBlockContent,
): JSONContent {
  if (!editor.schema.nodes[block.type]) throw new BlockError(`Unknown block type "${block.type}".`);
  const parsed = markdown(editor).parse(block.text).content ?? [];
  if (parsed.length > 1) throw new BlockError('The new content must be a single block.');
  const first = parsed[0];

  if (INLINE_BLOCKS.has(block.type)) {
    if (first && first.type !== 'paragraph') {
      throw new BlockError(`Expected inline text for a ${block.type}, got a ${first.type}.`);
    }
    return {
      type: block.type,
      attrs: { ...block.attrs, id: blockId },
      content: first?.content ?? [],
    };
  }
  if (!first || first.type !== block.type) {
    throw new BlockError(`The Markdown does not describe a ${block.type}.`);
  }
  return { ...first, attrs: { ...first.attrs, ...block.attrs, id: blockId } };
}

/** Replaces one top-level block in a single transaction, so one Undo reverts it. */
export function replaceBlock(editor: Editor, blockId: string, block: BodyBlockContent): void {
  let from = -1;
  let size = 0;
  editor.state.doc.forEach((node, offset) => {
    if (node.attrs.id === blockId) {
      from = offset;
      size = node.nodeSize;
    }
  });
  if (from < 0) throw new BlockError(`No block with id "${blockId}". It may have been deleted.`);
  const node = editor.schema.nodeFromJSON(fromBodyBlock(editor, blockId, block));
  editor.view.dispatch(editor.state.tr.replaceWith(from, from + size, node));
}
