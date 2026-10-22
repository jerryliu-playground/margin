# 0006. Host-neutral `EditorHost` and document model

- Status: Accepted
- Date: 2026-10-21
- Changes: the `EditorHost` sketch and data model in SPEC.md §5

## Context

The agent panel must later run in a Strapi 5 admin plugin and a Gutenberg sidebar. Research found four problems in the original design:

1. **Key in the browser.** "A URL and a key" in a host bundle is readable by every admin user.
2. **Body format.** TipTap JSON cannot represent Strapi Blocks (Slate JSON) or Gutenberg blocks (HTML strings).
3. **Block ids.** Strapi Blocks have no ids; Gutenberg `clientId`s live for one session only.
4. **Field set.** Hosts have different fields and types (WordPress tags are term ids; meta description may live in an SEO plugin).

## Decision

1. **No secret in the browser.** The panel asks the host for a short-lived token: `getAuthToken(): Promise<string>`. In our demo, `apps/web` gets it from our server; in a CMS, the CMS backend proxies or mints it. The model key never leaves `apps/server`.
2. **Host-neutral body.** `DocumentState.body` is `BodyBlock[]`: `{ blockId, type, text, attrs? }`. `text` is plain text with inline marks as Markdown. Each host converts to and from its own format. TipTap JSON stays inside `apps/web`.
3. **Opaque, session-scoped block ids, plus a content hash.** `blockId` is host-issued and only promised stable for the editing session. Each body proposal stores `baseHash` (hash of the block's `text` when proposed). On Accept, if the current hash differs, the proposal is shown as stale and not applied.
4. **Fields come from the host.** `getSchema(): FieldDescriptor[]` (name, label, kind `text | textarea | slug | tags`, optional `maxLength`). `FieldName` is a string validated against that schema. Field values are `string | string[]`; the host resolves tags to its own ids.

Also:

- **Accept means applied to the editor, not saved.** Saving stays the host's job.
- Panel CSS is scoped and prefixed (`margin-` class prefix, no global resets).
- Focus after Accept/Reject stays inside the panel.

```ts
interface EditorHost {
  getSchema(): FieldDescriptor[];
  getState(): DocumentState;
  subscribe(onChange: (s: DocumentState) => void): () => void;
  applyFieldValue(field: FieldName, value: FieldValue): Promise<void>;
  applyBodyEdit(blockId: string, block: BodyBlockContent): Promise<void>;
  getAuthToken(): Promise<string>;
}
```

The zod schemas and types live in `packages/shared/src/editor-host.ts`.

## Consequences

- Easy: one panel and one agent server for every host; the agent prompt sees one shape.
- Harder: every host writes a body converter. Inline formatting beyond Markdown marks is out of scope.
- Watch: Markdown round trip in TipTap must be tested in Phase 1.

## Alternatives considered

- **Keep TipTap JSON as the shared body**: forces every CMS to speak ProseMirror.
- **Persist ids into CMS content**: possible in WordPress via a block attribute filter, unverified in Strapi. Not needed if proposals carry `baseHash`.
