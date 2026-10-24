# 0010. Strapi 5 plugin: side panel, token endpoint, workspace layout

- Status: Accepted
- Date: 2026-10-24

## Context

SPEC §7 Phase 4 puts the agent panel into Strapi's Content Manager edit view, with `EditorHost` on Strapi's form state (ADR 0006). Research on Strapi 5.59.0 (2026-10-21), details in `docs/plans/phase-4.md`:

- `getPlugin('content-manager').apis.addEditViewSidePanel` is the documented way to add UI beside the edit form. Panels render inside the form, in a column 3 of 12 grid columns wide; there is no wide option.
- The unsaved values and `onChange` come from `useForm` (exported from `@strapi/strapi/admin`, undocumented). The content type's attributes come from `unstable_useContentManagerContext`.
- Plugin server routes are admin-only by default. Strapi's fetch client cannot stream.
- Blocks (the rich text field) have no ids.

## Decision

1. **Side panel.** The plugin registers one side panel that renders `@margin/agent-panel` with a Strapi `EditorHost`.
2. **Token endpoint, direct connection.** The plugin's server part exposes `POST /margin/token` (admin only). It signs the same short-lived HMAC token as the Margin server, with a shared `MARGIN_TOKEN_SECRET`. The panel then calls the Margin server's `/agent` directly; the server's CORS allows the origins in `CMS_ORIGINS`. Tokens carry `iss` and `sub`.
3. **`packages/agent-token`.** Token issue and verify live in a Node-only package used by `apps/server` and `plugins/strapi`. `packages/shared` stays browser-safe.
4. **Workspace layout.** `plugins/strapi` (the plugin) and `examples/strapi` (a Strapi 5 project with SQLite, an Article type and an `seo` component) join the pnpm workspace.
5. **Fields from the content type.** `string` becomes text, `text` becomes textarea, `uid` becomes slug, `maxLength` comes from the schema. Fields inside a single, non-repeatable component are exposed one level deep (`seo.metaDescription`). The plugin config lists the content types that get the panel and names the body field.
6. **One adapter file.** Every Strapi admin hook is imported in `plugins/strapi/admin/src/strapi-form.ts`, and the Strapi version is pinned (ADR 0007).
7. **Tests.** Plugin logic is unit-tested in `pnpm check`. The end-to-end test against a running Strapi is `pnpm e2e:strapi`, run in its own CI job, with the mock model.

## Consequences

- Easy: one agent server for every host; the token format is defined once; SSE stays on Fastify, where it is tested.
- Harder: the Margin server needs CORS for each CMS origin, and the secret is shared between two deployments.
- Watch: `useForm` and `unstable_useContentManagerContext` may change in a Strapi minor release; the adapter file and the e2e job are where that shows.
- Watch: duplicate React or `@strapi/*` copies break the admin ("must be used within StrapiApp"). The plugin declares them as peer dependencies.
- Watch: the workspace install grows by several hundred packages.

## Alternatives considered

- **A drawer opened from a small side panel:** wider, but our own overlay code and part of the form hidden. Kept as the fallback if the column is too narrow.
- **Strapi proxies `/agent`:** no CORS, but SSE through Koa, which Strapi does not document.
- **Copy the token code into the plugin:** two definitions of one format that can drift.
- **Asymmetric tokens (Strapi signs, Margin verifies with a public key):** right for many CMSs sharing one server; more setup than one deployment needs.
