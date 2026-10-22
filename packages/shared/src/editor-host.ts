import { z } from 'zod';

/** Kinds of field a host can expose. Drives the proposal card and validation. */
export const fieldKindSchema = z.enum(['text', 'textarea', 'slug', 'tags']);
export type FieldKind = z.infer<typeof fieldKindSchema>;

/** A field name is host-defined; it is valid only if the host's schema lists it. */
export const fieldNameSchema = z.string().min(1).max(64);
export type FieldName = z.infer<typeof fieldNameSchema>;

/** Plain string, or a list of strings for `tags`. Hosts map tags to their own ids. */
export const fieldValueSchema = z.union([z.string(), z.array(z.string())]);
export type FieldValue = z.infer<typeof fieldValueSchema>;

export const fieldDescriptorSchema = z.object({
  name: fieldNameSchema,
  label: z.string().min(1),
  kind: fieldKindSchema,
  maxLength: z.number().int().positive().optional(),
});
export type FieldDescriptor = z.infer<typeof fieldDescriptorSchema>;

/** The content of one body block, without its id. `text` uses Markdown for inline marks. */
export const bodyBlockContentSchema = z.object({
  type: z.string().min(1),
  text: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});
export type BodyBlockContent = z.infer<typeof bodyBlockContentSchema>;

/** One top-level block of the host-neutral body. `blockId` is opaque and session-scoped. */
export const bodyBlockSchema = bodyBlockContentSchema.extend({
  blockId: z.string().min(1),
});
export type BodyBlock = z.infer<typeof bodyBlockSchema>;

/** What the agent sees: field values plus the body. Sent as AG-UI shared state. */
export const documentStateSchema = z.object({
  fields: z.record(fieldNameSchema, fieldValueSchema),
  body: z.array(bodyBlockSchema),
});
export type DocumentState = z.infer<typeof documentStateSchema>;

/**
 * The only way the agent panel talks to an editor (SPEC §5, ADR 0006).
 * Implemented by apps/web (TipTap) and later by plugins/strapi and plugins/wordpress.
 */
export interface EditorHost {
  getSchema(): FieldDescriptor[];
  getState(): DocumentState;
  subscribe(onChange: (state: DocumentState) => void): () => void;
  /** Applies to the editor only. Saving stays with the host. */
  applyFieldValue(field: FieldName, value: FieldValue): Promise<void>;
  applyBodyEdit(blockId: string, block: BodyBlockContent): Promise<void>;
  /** Short-lived token for the agent server. Never a long-lived secret. */
  getAuthToken(): Promise<string>;
}
