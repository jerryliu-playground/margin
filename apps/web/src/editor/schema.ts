import { DOCUMENT_LIMITS, type FieldDescriptor } from '@margin/shared';

/**
 * Lengths the agent is asked to respect, tighter than what storage accepts
 * (DOCUMENT_LIMITS): common SEO guidance for titles and meta descriptions.
 * The person typing in the form is not held to these.
 */
export const SEO_LIMITS = { title: 60, metaDescription: 160 } as const;

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
