import type { DocumentSummary } from '@margin/shared';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { relativeTime } from '../relative-time';
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
        <button type="button" className="button--primary" onClick={create} disabled={creating}>
          New document
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!documents && !error && <p>Loading…</p>}
      {documents?.length === 0 && (
        <p className="doc-list__empty">No documents yet. Create one to start writing.</p>
      )}
      {documents && documents.length > 0 && (
        <ul className="doc-list">
          {documents.map((doc) => {
            const updated = new Date(doc.updatedAt);
            return (
              <li key={doc.id} className="doc-card">
                <a href={documentHref(doc.id)} className="doc-card__title">
                  {doc.title || 'Untitled'}
                </a>
                <span className="muted">
                  Updated{' '}
                  <time dateTime={doc.updatedAt} title={updated.toLocaleString()}>
                    {relativeTime(updated)}
                  </time>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
