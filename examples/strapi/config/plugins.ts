import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  // The Margin agent panel (plugins/strapi, ADR 0010).
  margin: {
    enabled: true,
    config: {
      agentUrl: env('MARGIN_AGENT_URL', 'http://localhost:8790'),
      tokenSecret: env('MARGIN_TOKEN_SECRET'),
      contentTypes: { 'api::article.article': { body: 'body' } },
    },
  },
});

export default config;
