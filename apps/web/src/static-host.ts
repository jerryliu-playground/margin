import type { DocumentState, EditorHost, FieldDescriptor } from '@margin/shared';

const schema: FieldDescriptor[] = [
  { name: 'title', label: 'Title', kind: 'text', maxLength: 120 },
  { name: 'slug', label: 'Slug', kind: 'slug' },
  { name: 'summary', label: 'Summary', kind: 'textarea' },
  { name: 'metaDescription', label: 'Meta description', kind: 'textarea', maxLength: 160 },
  { name: 'tags', label: 'Tags', kind: 'tags' },
];

/**
 * Phase 0 placeholder host with a fixed, read-only document.
 * Phase 1 replaces it with the TipTap host (ADR 0001).
 */
export function createStaticHost(): EditorHost {
  const state: DocumentState = {
    fields: { title: '', slug: '', summary: '', metaDescription: '', tags: [] },
    body: [],
  };
  return {
    getSchema: () => schema,
    getState: () => state,
    subscribe: () => () => {},
    applyFieldValue: () => Promise.reject(new Error('The Phase 0 host is read-only.')),
    applyBodyEdit: () => Promise.reject(new Error('The Phase 0 host is read-only.')),
    getAuthToken: () => Promise.resolve('dev-token'),
  };
}
