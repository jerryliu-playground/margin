import { DOCUMENT_LIMITS, SEO_LIMITS, type FieldDescriptor } from '@margin/shared';

// The agent is held to SEO_LIMITS (the same numbers seoCheck uses), tighter than what
// storage accepts (DOCUMENT_LIMITS). The person typing in the form is not.

/** The demo document's fields, as the agent sees them (EditorHost.getSchema). */
export const DEMO_SCHEMA: FieldDescriptor[] = [
  { name: 'title', label: 'Title', kind: 'text', maxLength: SEO_LIMITS.title },
  { name: 'slug', label: 'Slug', kind: 'slug', maxLength: DOCUMENT_LIMITS.slug },
  { name: 'summary', label: 'Summary', kind: 'textarea', maxLength: DOCUMENT_LIMITS.summary },
  {
    name: 'metaDescription',
    label: 'Meta description',
    kind: 'textarea',
    maxLength: SEO_LIMITS.metaDescription,
  },
  { name: 'tags', label: 'Tags', kind: 'tags' },
];
