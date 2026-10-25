import { cmsPanelSettingsSchema } from '@margin/shared';
import { z } from 'zod';

/**
 * The plugin's config, set in the Strapi project's config/plugins.ts:
 * `margin: { config: { agentUrl, tokenSecret: env('MARGIN_TOKEN_SECRET'), contentTypes } }`.
 */
export const marginConfigSchema = cmsPanelSettingsSchema.extend({
  /** The Margin server's MARGIN_TOKEN_SECRET. Stays on the Strapi server. */
  tokenSecret: z
    .string()
    .min(32, "tokenSecret must be the Margin server's MARGIN_TOKEN_SECRET (32+ characters)."),
});
export type MarginConfig = z.infer<typeof marginConfigSchema>;

export default {
  default: { agentUrl: 'http://localhost:8790' },
  validator(config: unknown) {
    const result = marginConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid config for the Margin plugin: ${z.prettifyError(result.error)}`);
    }
  },
};
