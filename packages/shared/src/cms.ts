import { z } from 'zod';

/** One content type that gets the agent panel in a CMS host (ADR 0010). */
export const cmsContentTypeSettingsSchema = z.object({
  /** The rich text attribute the agent edits block by block; fields only when absent. */
  body: z.string().min(1).optional(),
});

/** What a CMS plugin's admin needs from its own server: GET /margin/settings in Strapi. */
export const cmsPanelSettingsSchema = z.object({
  agentUrl: z.url(),
  /** Keyed by the CMS's content type id, e.g. "api::article.article". */
  contentTypes: z.record(z.string().min(1), cmsContentTypeSettingsSchema),
});
export type CmsPanelSettings = z.infer<typeof cmsPanelSettingsSchema>;
