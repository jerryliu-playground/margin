import type { Editor, JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import type { BodyJson } from '@margin/shared';
import { useEffect } from 'react';
import { editorExtensions } from './extensions';

interface BodyEditorProps {
  initialContent: BodyJson;
  labelledBy: string;
  onReady: (editor: Editor) => void;
  onChange: () => void;
}

export function BodyEditor({ initialContent, labelledBy, onReady, onChange }: BodyEditorProps) {
  const editor = useEditor({
    extensions: editorExtensions,
    // bodyJsonSchema checked the outer shape; ProseMirror checks the nodes when it loads them.
    content: initialContent as JSONContent,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelledBy,
        class: 'body-editor',
      },
    },
    onUpdate: ({ transaction }) => {
      if (transaction.docChanged) onChange();
    },
  });

  useEffect(() => {
    if (editor) onReady(editor);
  }, [editor, onReady]);

  return <EditorContent editor={editor} />;
}
