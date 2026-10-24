import { AgentPanel } from '@margin/agent-panel';
import type { Document, DocumentContent, EditorHost } from '@margin/shared';
import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { AGENT_URL, api, getAuthToken } from '../api';
import { BodyEditor } from '../editor/BodyEditor';
import { createFieldStore, type FieldStore } from '../editor/document-store';
import { DEMO_SCHEMA } from '../editor/schema';
import { createTipTapHost } from '../editor/tiptap-host';

const parseTags = (value: string) =>
  value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
const text = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

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
  return <DocumentEditor doc={doc} />;
}

function DocumentEditor({ doc }: { doc: Document }) {
  const bodyLabelId = useId();
  const tagsHintId = useId();
  const editorRef = useRef<Editor | null>(null);
  const tagsRef = useRef<HTMLInputElement>(null);
  const [store] = useState<FieldStore>(() =>
    createFieldStore({
      title: doc.title,
      slug: doc.slug,
      summary: doc.summary,
      metaDescription: doc.metaDescription,
      tags: doc.tags,
    }),
  );
  const values = useSyncExternalStore(store.subscribe, store.get);
  const [host, setHost] = useState<EditorHost>();
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');

  // Any change marks the document dirty. Tags typed by the user stay as typed;
  // tags applied by the host (an accepted proposal) are written back into the input.
  useEffect(
    () =>
      store.subscribe((name, origin) => {
        setDirty(true);
        setStatus('');
        if (name === 'tags' && origin === 'host' && tagsRef.current) {
          tagsRef.current.value = list(store.get().tags).join(', ');
        }
      }),
    [store],
  );

  const onEditorReady = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setHost(createTipTapHost({ editor, fields: store, schema: DEMO_SCHEMA, getAuthToken }));
    },
    [store],
  );
  const onBodyChange = useCallback(() => {
    setDirty(true);
    setStatus('');
  }, []);

  const save = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    setStatus('Saving…');
    const v = store.get();
    try {
      await api.saveDocument(doc.id, {
        title: text(v.title),
        slug: text(v.slug),
        summary: text(v.summary),
        metaDescription: text(v.metaDescription),
        tags: list(v.tags),
        body: editor.getJSON() as DocumentContent['body'],
      });
      setDirty(false);
      setStatus('Saved');
    } catch (e) {
      setStatus(`Not saved: ${(e as Error).message}`);
    }
  };

  const input = (name: 'title' | 'slug') => (
    <input value={text(values[name])} onChange={(e) => store.set(name, e.target.value)} />
  );
  const textarea = (name: 'summary' | 'metaDescription') => (
    <textarea
      rows={2}
      value={text(values[name])}
      onChange={(e) => store.set(name, e.target.value)}
    />
  );

  return (
    <div className="layout">
      <main className="page">
        <form
          className="doc-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="doc-header">
            <div className="doc-header__title">
              <a href="#/" className="doc-header__back">
                All documents
              </a>
              <h1>{text(values.title) || 'Untitled'}</h1>
            </div>
            <div className="doc-header__actions">
              <span role="status" className="muted">
                {status || (dirty ? 'Unsaved changes' : '')}
              </span>
              <button type="submit" className="button--primary">
                Save
              </button>
            </div>
          </div>
          <fieldset className="doc-section">
            <legend>Content</legend>
            <label>
              Title
              {input('title')}
            </label>
            <label>
              Summary
              {textarea('summary')}
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
          </fieldset>
          <fieldset className="doc-section">
            <legend>Search and sharing</legend>
            <label>
              Slug
              {input('slug')}
            </label>
            <label>
              Meta description
              {textarea('metaDescription')}
            </label>
            <label>
              Tags
              <input
                ref={tagsRef}
                defaultValue={doc.tags.join(', ')}
                aria-describedby={tagsHintId}
                onChange={(e) => store.set('tags', parseTags(e.target.value))}
              />
              <span id={tagsHintId} className="muted">
                Separate tags with commas.
              </span>
            </label>
          </fieldset>
        </form>
      </main>
      {host && <AgentPanel host={host} agentUrl={AGENT_URL} />}
    </div>
  );
}
