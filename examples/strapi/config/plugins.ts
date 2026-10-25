import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  // The Margin agent panel (plugins/strapi, ADR 0010). No contentTypes: every content type
  // gets the panel and its first Blocks attribute is the body (ADR 0011). To limit it:
  // contentTypes: { 'api::article.article': {}, 'api::product.product': { body: false } }
  margin: {
    enabled: true,
    config: {
      agentUrl: env('MARGIN_AGENT_URL', 'http://localhost:8790'),
      tokenSecret: env('MARGIN_TOKEN_SECRET'),
    },
  },
});

export default config;
