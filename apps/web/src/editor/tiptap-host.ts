import {
  fieldValueSchema,
  type DocumentState,
  type EditorHost,
  type FieldDescriptor,
} from '@margin/shared';
import type { Editor } from '@tiptap/core';
import { replaceBlock, toBodyBlocks } from './blocks';
import type { FieldStore } from './document-store';

interface TipTapHostOptions {
  editor: Editor;
  fields: FieldStore;
  schema: FieldDescriptor[];
  getAuthToken: () => Promise<string>;
}

/** EditorHost for the demo app (SPEC §5): TipTap body plus a field store. */
export function createTipTapHost({
  editor,
  fields,
  schema,
  getAuthToken,
}: TipTapHostOptions): EditorHost {
  // getState returns the same object until something changes (useSyncExternalStore), and is
  // fresh even with no subscribers: changes mark it dirty, the next read rebuilds it.
  let state: DocumentState | undefined;
  const listeners = new Set<(s: DocumentState) => void>();
  const getState = () => (state ??= { fields: fields.get(), body: toBodyBlocks(editor) });
  const changed = () => {
    state = undefined;
    if (listeners.size === 0) return;
    const next = getState();
    listeners.forEach((l) => l(next));
  };
  editor.on('update', changed);
  fields.subscribe(changed);

  const descriptor = (name: string) => {
    const field = schema.find((f) => f.name === name);
    if (!field) throw new Error(`Unknown field "${name}".`);
    return field;
  };

  return {
    getSchema: () => schema,
    getState,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    async applyFieldValue(name, value) {
      const field = descriptor(name);
      const parsed = fieldValueSchema.parse(value);
      if ((field.kind === 'tags') !== Array.isArray(parsed)) {
        throw new Error(
          `Field "${name}" expects ${field.kind === 'tags' ? 'a list of tags' : 'text'}.`,
        );
      }
      if (field.maxLength && typeof parsed === 'string' && parsed.length > field.maxLength) {
        throw new Error(`Field "${name}" allows at most ${field.maxLength} characters.`);
      }
      fields.set(name, parsed, 'host');
    },
    async applyBodyEdit(blockId, block) {
      replaceBlock(editor, blockId, block);
    },
    getAuthToken,
  };
}
