---
name: add-document-field
description: Add a new field to Margin's document end to end (shared schema, SQLite migration, editor form, agent awareness, tests). Use whenever a task adds, renames or removes a document field such as title, slug, summary, metaDescription or tags.
---

# Add a document field

A field is a named, non-body value of a document (`docs/domain.md`). Adding one touches five places; miss one and the field silently disappears on save, or the agent cannot see it.

Read `SPEC.md` §5 (data model) and ADR 0006 (fields come from the host) first.

## Steps

1. **Shared schema (`packages/shared/src/document.ts`).**
   - Add the field to `documentContentSchema`, with a limit in `DOCUMENT_LIMITS` for strings and arrays.
   - Add its name to `DOCUMENT_FIELDS` (display order).
   - Field values are `string` or `string[]` only (`fieldValueSchema`). Anything else needs an ADR, because every host must support it.
   - Test it in `document.test.ts`: one valid value, one over the limit.
2. **Database (`apps/server/src/db/schema.ts`).**
   - Add a column. Give it a default (`.notNull().default('')` or `.default('[]')` for JSON) so existing rows stay valid.
   - Run `pnpm --filter @margin/server db:generate`, read the generated SQL in `apps/server/drizzle/`, and commit it. Never edit an applied migration; add a new one.
   - Fill the default in `createDocumentRepository().create` in `documents/repository.ts`.
   - `documents/routes.test.ts`: create → update with the field → read it back.
3. **Editor form (`apps/web/src/pages/DocumentPage.tsx`).**
   - Add the initial value to `createFieldStore(...)`, an input with a visible `<label>`, and the value in `save()`.
   - Text inputs are controlled from the store. List-like fields keep their own text, like `tags` (typed text stays as typed; host-applied values are written back).
4. **Agent awareness (`apps/web/src/editor/schema.ts`).**
   - Add a `FieldDescriptor` to `DEMO_SCHEMA` with the right `kind` and the `maxLength` the agent should respect (it can be tighter than the storage limit; see `SEO_LIMITS`).
   - Nothing else is needed: the panel validates proposals against `getSchema()` and the server lists the fields in the prompt.
   - If e2e needs the agent to propose the field, add a keyword to `apps/server/src/agent/mock-model.ts` (see the `write-e2e-test` skill).
5. **Tests and docs.**
   - E2E (`e2e/documents.spec.ts`): fill the field, save, reload, still there. Use `field(page, 'Label')` from `e2e/helpers.ts`.
   - Add the field to the glossary entry for **Field** in `docs/domain.md` and to the data model in `SPEC.md` §5 and `docs/architecture.md`.
6. Run `pnpm check`.

## Don'ts

- No field that only exists in one layer: if it is stored, it is in the shared schema; if the agent may change it, it is in `DEMO_SCHEMA`.
- No host-specific field logic in `packages/agent-panel` (CLAUDE.md rule 7).
- Removing or renaming a field is a migration plus a data decision: ask the owner first.
