# Margin for Strapi 5

Adds Margin's agent panel to the Content Manager edit view (ADR 0010). The agent proposes field values; nothing changes until you accept, and saving stays with Strapi.

- `admin/src`: the side panel and the Strapi `EditorHost`. Every Strapi admin hook is imported in one adapter file.
- The panel takes Strapi's colours, light or dark, and caps its height so a long conversation scrolls inside it.
- `server/src`: `GET /margin/settings` and `POST /margin/token` (admin only). The token is signed with the Margin server's `MARGIN_TOKEN_SECRET`, so the browser never holds a long-lived secret.

Config, in the Strapi project's `config/plugins.ts`:

```ts
margin: {
  enabled: true,
  config: {
    agentUrl: env('MARGIN_AGENT_URL'),          // the Margin server
    tokenSecret: env('MARGIN_TOKEN_SECRET'),    // same value as on the Margin server
  },
},
```

Every content type the project defines gets the panel, including the ones editors build later, and the agent's body is the type's first Blocks attribute (ADR 0011). Fields come from each type's schema: text, long text, UID, and the same inside a single (non-repeatable) component such as `seo`. Relations, media, enumerations, Markdown rich text, repeatable components and dynamic zones are left out.

To limit or adjust it, add `contentTypes` (an allowlist):

```ts
contentTypes: {
  'api::article.article': {},                       // body: its first Blocks attribute
  'api::product.product': { body: 'description' },  // name the body
  'api::faq.faq': { body: false },                  // fields only
},
```

The Margin server must list the Strapi admin origin in `CMS_ORIGINS`. Try it with `pnpm dev:strapi` (see `examples/strapi`).
