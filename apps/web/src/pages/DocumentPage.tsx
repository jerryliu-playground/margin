import type { Document, DocumentContent } from '@margin/shared';
import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api } from '../api';
import { BodyEditor } from '../editor/BodyEditor';

type Fields = Pick<DocumentContent, 'title' | 'slug' | 'summary' | 'metaDescription' | 'tags'>;

const parseTags = (value: string) =>
  value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

export function DocumentPage({ id }: { id: string }) {
  const [doc, setDoc] = useState<Document>();
  const [error, setError] = useState<string>();

  // App keys this component by id, so a new id starts from a fresh state.
  useEffect(() => {
    api.getDocument(id).then(setDoc, (e: Error) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <main className="page">
        <p role="alert">{error}</p>
      </main>
    );
  if (!doc)
    return (
      <main className="page">
        <p>Loading…</p>
      </main>
    );
  return <DocumentEditor key={doc.id} doc={doc} />;
}

function DocumentEditor({ doc }: { doc: Document }) {
  const bodyLabelId = useId();
  const editorRef = useRef<Editor | null>(null);
  const [fields, setFields] = useState<Fields>(doc);
  const [tagsText, setTagsText] = useState(doc.tags.join(', '));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string>('');

  const setField = <K extends keyof Fields>(name: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [name]: value }));
    setDirty(true);
  };

  const onEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);
  const onBodyChange = useCallback(() => setDirty(true), []);

  const save = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    setStatus('Saving…');
    try {
      await api.saveDocument(doc.id, {
        ...fields,
        tags: parseTags(tagsText),
        body: editor.getJSON() as DocumentContent['body'],
      });
      setDirty(false);
      setStatus('Saved');
    } catch (e) {
      setStatus(`Not saved: ${(e as Error).message}`);
    }
  };

  return (
    <main className="page">
      <p>
        <a href="#/">All documents</a>
      </p>
      <h1>{fields.title || 'Untitled'}</h1>
      <form
        className="doc-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Title
          <input value={fields.title} onChange={(e) => setField('title', e.target.value)} />
        </label>
        <label>
          Slug
          <input value={fields.slug} onChange={(e) => setField('slug', e.target.value)} />
        </label>
        <label>
          Summary
          <textarea
            rows={2}
            value={fields.summary}
            onChange={(e) => setField('summary', e.target.value)}
          />
        </label>
        <label>
          Meta description
          <textarea
            rows={2}
            value={fields.metaDescription}
            onChange={(e) => setField('metaDescription', e.target.value)}
          />
        </label>
        <label>
          Tags
          <input
            value={tagsText}
            aria-describedby={`${bodyLabelId}-tags-hint`}
            onChange={(e) => {
              setTagsText(e.target.value);
              setDirty(true);
            }}
          />
          <span id={`${bodyLabelId}-tags-hint`} className="muted">
            Separate tags with commas.
          </span>
        </label>
        <div className="doc-form__body">
          <span id={bodyLabelId} className="label">
            Body
          </span>
          <BodyEditor
            initialContent={doc.body}
            labelledBy={bodyLabelId}
            onReady={onEditorReady}
            onChange={onBodyChange}
          />
        </div>
        <div className="doc-form__actions">
          <button type="submit">Save</button>
          <span role="status" className="muted">
            {status || (dirty ? 'Unsaved changes' : '')}
          </span>
        </div>
      </form>
    </main>
  );
}
