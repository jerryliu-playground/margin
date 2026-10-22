import Image from '@tiptap/extension-image';
import UniqueID from '@tiptap/extension-unique-id';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

/** Block types that get a stable `id` attribute (ADR 0001). */
export const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'codeBlock',
  'horizontalRule',
  'image',
];

export const editorExtensions = [
  // No trailing-node plugin: it would add an empty paragraph the agent sees as a block.
  StarterKit.configure({ heading: { levels: [2, 3, 4] }, trailingNode: false }),
  // Images are blocks (not inline), so each one has its own block id and alt text.
  Image.configure({ inline: false, allowBase64: false }),
  UniqueID.configure({ types: BLOCK_TYPES }),
  Markdown,
];
