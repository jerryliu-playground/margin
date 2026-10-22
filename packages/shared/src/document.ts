import { z } from 'zod';

/** Limits that keep the deployed demo from accepting large documents (SPEC §6). */
export const DOCUMENT_LIMITS = {
  title: 200,
  slug: 120,
  summary: 1000,
  metaDescription: 320,
  tags: 20,
  tag: 40,
  bodyBytes: 200_000,
} as const;

export const slugSchema = z
  .string()
  .max(DOCUMENT_LIMITS.slug)
  .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens.');

/**
 * Stored body: TipTap JSON with UniqueID block ids (ADR 0001).
 * Only the outer shape is checked here; apps/web owns the node types.
 */
export const bodyJsonSchema = z
  .looseObject({ type: z.literal('doc'), content: z.array(z.unknown()).optional() })
  .refine((body) => JSON.stringify(body).length <= DOCUMENT_LIMITS.bodyBytes, {
    message: `The body is too large (limit ${DOCUMENT_LIMITS.bodyBytes} bytes).`,
  });
export type BodyJson = z.infer<typeof bodyJsonSchema>;

export const EMPTY_BODY: BodyJson = { type: 'doc', content: [{ type: 'paragraph' }] };

/** Editable parts of a document. */
export const documentContentSchema = z.object({
  title: z.string().max(DOCUMENT_LIMITS.title),
  slug: slugSchema,
  summary: z.string().max(DOCUMENT_LIMITS.summary),
  metaDescription: z.string().max(DOCUMENT_LIMITS.metaDescription),
  tags: z.array(z.string().min(1).max(DOCUMENT_LIMITS.tag)).max(DOCUMENT_LIMITS.tags),
  body: bodyJsonSchema,
});
export type DocumentContent = z.infer<typeof documentContentSchema>;

export const documentSchema = documentContentSchema.extend({
  id: z.uuid(),
  updatedAt: z.iso.datetime(),
});
export type Document = z.infer<typeof documentSchema>;

/** The non-body field names of our demo document, in display order. */
export const DOCUMENT_FIELDS = ['title', 'slug', 'summary', 'metaDescription', 'tags'] as const;
export type DocumentFieldName = (typeof DOCUMENT_FIELDS)[number];
