import type { DocumentSummary } from '@margin/shared';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { documentHref } from '../router';

export function DocumentListPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>();
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.listDocuments().then(setDocuments, (e: Error) => setError(e.message));
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      const doc = await api.createDocument();
      window.location.hash = documentHref(doc.id);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  return (
    <main className="page">
      <div className="page__header">
        <h1>Documents</h1>
        <button type="button" onClick={create} disabled={creating}>
          New document
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!documents && !error && <p>Loading…</p>}
      {documents && (
        <ul className="doc-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <a href={documentHref(doc.id)}>{doc.title || 'Untitled'}</a>{' '}
              <span className="muted">updated {new Date(doc.updatedAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
