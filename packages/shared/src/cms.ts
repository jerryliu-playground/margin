import { z } from 'zod';

/** One content type that gets the agent panel in a CMS host (ADR 0010, ADR 0011). */
export const cmsContentTypeSettingsSchema = z.object({
  /**
   * The rich text attribute the agent edits block by block. Absent: the type's first rich
   * text attribute; false: no body, fields only.
   */
  body: z.union([z.string().min(1), z.literal(false)]).optional(),
});

/** What a CMS plugin's admin needs from its own server: GET /margin/settings in Strapi. */
export const cmsPanelSettingsSchema = z.object({
  agentUrl: z.url(),
  /**
   * Keyed by the CMS's content type id, e.g. "api::article.article". Absent: every content
   * type the project defines gets the panel (ADR 0011); present: only these.
   */
  contentTypes: z.record(z.string().min(1), cmsContentTypeSettingsSchema).optional(),
});
export type CmsPanelSettings = z.infer<typeof cmsPanelSettingsSchema>;
