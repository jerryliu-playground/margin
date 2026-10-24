# Phase 4 plan: Strapi plugin

Approved by the owner on 2026-10-24, with decisions 2a and 5a below. One concern per commit; each commit passes `pnpm check` on its own (CLAUDE.md rule 8).

**Goal (SPEC §7):** a Strapi 5 plugin that adds the agent panel to the Content Manager edit view, with `EditorHost` implemented on Strapi's form state. **Done when** a Playwright test, in a local Strapi project with a sample content type, asks for a meta description, accepts the proposal, saves, and finds the new value on the entry. After that: the Blocks body, then the video.

**Resuming:** compare the steps with `git log --oneline`. Each step's commit subject starts with its tag (e.g. `P4.3`). Start at the first unticked step and tick it in the same commit.

## What the research found (Strapi 5.59.0, 2026-10-21)

- **Where the panel goes:** `getPlugin('content-manager').apis.addEditViewSidePanel([...])`, the documented API. A panel gets `{ model, documentId, document, activeTab, … }` and returns `{ title, content }`. It renders in the right-hand column (3 of 12 grid columns, about 300 px), below the "Entry" panel; on phones, inside the actions drawer. There is no wide option.
- **Form state:** side panels render inside the edit view's form. `useForm(name, selector)` reads the unsaved `values` and gives `onChange(field, value)`; it is exported from `@strapi/strapi/admin` but not documented. The content type's attributes come from `unstable_useContentManagerContext()`, which is explicitly unstable.
- **Blocks body:** a Slate-like JSON array (paragraph, heading 1–6, list, quote, code, image; inline text with bold/italic/underline/strikethrough/code marks and links). **Blocks have no ids**, as ADR 0006 assumed.
- **Auth and routes:** plugin server routes are admin-only by default; the admin calls them with `useFetchClient()`. That client cannot stream, so SSE needs native `fetch`.
- **Admin bundle:** React 18 and Vite, so our panel (React 18, plain CSS) fits. Duplicate React or `@strapi/*` copies cause "must be used within StrapiApp" errors, so the plugin must not bundle its own copies.

## Decisions

1. **The panel sits in the right column, as a side panel** (recommended). It is the documented API, and the form stays in view while you review cards. The panel already works at phone width (375 px), so 300 px is tight but usable. _Alternative:_ a small side panel with a button that opens the full panel in a drawer over the right part of the page. That is wider, but it means building our own drawer and hiding part of the form. We can still switch later if the column feels cramped.
2. **The browser talks to the Margin server directly; Strapi only issues the token** (recommended).
   - The plugin's server part has one admin-only route, `POST /margin/token`. It signs the same 15-minute token as our server, using a shared `MARGIN_TOKEN_SECRET`.
   - The Margin server allows the Strapi admin origin through a new CORS setting.
   - One agent server for every host (SPEC §5), and SSE stays on Fastify, where it is tested.
   - _Alternative:_ the Strapi server proxies `/agent`. That means no CORS, but we would stream SSE through Koa, which Strapi does not document.
3. **The token code moves into a small shared package, `packages/agent-token`** (Node only, `node:crypto`). `apps/server` and the Strapi plugin both use it, so the token format is defined in one place. `packages/shared` stays free of Node APIs, because it runs in the browser.
4. **Layout and tests.**
   - `plugins/strapi` holds the plugin. `examples/strapi` is a Strapi 5 project with SQLite and an Article content type (title, slug, summary, metaDescription, body as Blocks) plus a seeded article.
   - Unit tests for the plugin (field mapping, Blocks conversion, the host, the token route) run in `pnpm check`.
   - The Strapi end-to-end test is **not** part of `pnpm check`. Strapi is a large install and its admin build is slow. It runs as `pnpm e2e:strapi` and as its own CI job, against the mock model as always.
5. **Fields come from the content type.** The mapping is: `string` becomes text, `text` becomes textarea, `uid` becomes slug, and `maxLength` comes from the schema. The plugin's config says which content types get the panel, and which field is the body. Tags are left out for now, because Strapi tags are usually relations.
6. **The unstable Strapi APIs live in one file** (`plugins/strapi/admin/src/strapi-form.ts`), and the Strapi version is pinned. A Strapi upgrade that breaks them breaks one file, and the e2e job catches it.
7. **(2a) Tokens say who asked.** The token payload gains `iss` (`"demo"` or `"strapi"`) and `sub` (the Strapi admin's id; empty in the demo), for logs and later per-user limits. The format stays HMAC-signed and short-lived; asymmetric keys wait until more than one CMS shares a server.
8. **(5a) One level of components.** Many Strapi projects keep SEO fields in a single (non-repeatable) component such as `seo`. Fields inside one are exposed as `seo.metaDescription`, labelled "SEO › Meta description". The example project stores the meta description that way, so the e2e test covers it. A unit test first proves that `onChange` accepts the dotted path; if not, the host replaces the whole `seo` object.

## Steps

PR A (`phase-4` branch): fields.

- [x] **P4.0 Plan and ADR 0010**: this plan and ADR 0010 (Strapi plugin: placement, token, packages, tests). `docs/`.
- [x] **P4.1 `packages/agent-token`**: move token issue/verify out of `apps/server`; add `iss`/`sub` (decision 7). Workspace, `apps/server`.
- [x] **P4.2 CORS for CMS admins**: `CMS_ORIGINS` (a comma-separated allowlist, empty by default) added to the agent routes' CORS. `apps/server`.
- [x] **P4.3 Example Strapi project**: `examples/strapi` with the Article type, SQLite, an `seo` component (metaTitle, metaDescription), a seed article and a local test admin from env; a `pnpm dev:strapi` script; Strapi versions pinned in ADR 0007. `examples/strapi`.
- [ ] **P4.4 Plugin skeleton**: `plugins/strapi` (via `@strapi/sdk-plugin`), the `POST /margin/token` admin route, and an empty side panel; unit test for the route. `plugins/strapi`.
- [ ] **P4.5 Strapi `EditorHost` for fields**: schema mapping (pure, tested), a bridge from `useForm` values to `getState`/`subscribe`, and `applyFieldValue` through `onChange`; the agent panel in the side panel. The body is empty for now. `plugins/strapi`.
- [ ] **P4.6 Strapi end-to-end test**: ask for a meta description, Accept, Save, and check the entry's value through the Strapi API; axe on the panel. `playwright.strapi.config.ts`, `pnpm e2e:strapi`, CI job. Docs: README section, architecture.md, CLAUDE.md commands.

PR B: the Blocks body.

- [ ] **P4.7 Blocks ⇄ `BodyBlock`**: a pure converter covering paragraphs, headings, lists, quotes, code and images (alt text maps to `alternativeText`), with inline marks and links as Markdown; round-trip tests. Block ids are session-scoped (`b0`, `b1`, …) and protected by `baseHash`. `plugins/strapi`.
- [ ] **P4.8 `applyBodyEdit` in Strapi**: wired through `onChange('body', …)`; e2e for a body edit and for image alt text after an accessibility check. `plugins/strapi`, `e2e/`.
- [ ] **P4.9 Demo script**: add a Strapi segment to `docs/demo-script.md`; SPEC §7 marks Phase 4 done.

## Owner-only actions

None for PR A. After PR B: record the video (`docs/demo-script.md`).

## Out of scope

Publishing the plugin to npm or the Strapi marketplace; a hosted Strapi demo; tags as relations; the Markdown `richtext` field type; i18n locales.

## Risks to watch

- `useForm` and `unstable_useContentManagerContext` are undocumented or unstable: one adapter file, a pinned version, and the e2e job.
- Duplicate React or `@strapi/*` copies in the workspace: the plugin declares them as peer dependencies only, and the admin's Vite config dedupes React.
- 300 px column: if the cards feel cramped in real use, switch to the drawer (decision 1).
- Install size and CI time: Strapi adds several hundred packages; its CI job runs in parallel with `check`.
