import { DOCUMENT_LIMITS, type FieldDescriptor } from '@margin/shared';

/** The demo document's fields, as the agent sees them (EditorHost.getSchema). */
export const DEMO_SCHEMA: FieldDescriptor[] = [
  { name: 'title', label: 'Title', kind: 'text', maxLength: DOCUMENT_LIMITS.title },
  { name: 'slug', label: 'Slug', kind: 'slug', maxLength: DOCUMENT_LIMITS.slug },
  { name: 'summary', label: 'Summary', kind: 'textarea', maxLength: DOCUMENT_LIMITS.summary },
  {
    name: 'metaDescription',
    label: 'Meta description',
    kind: 'textarea',
    maxLength: DOCUMENT_LIMITS.metaDescription,
  },
  { name: 'tags', label: 'Tags', kind: 'tags' },
];
