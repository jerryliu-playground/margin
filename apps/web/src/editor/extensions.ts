import UniqueID from '@tiptap/extension-unique-id';
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
];

export const editorExtensions = [
  StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
  UniqueID.configure({ types: BLOCK_TYPES }),
];
