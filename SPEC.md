# Margin — AI-assisted content editor

> Working name. A content-editing back office (think: the editor screen of a CMS) with an AI agent built into the UI through the AG-UI protocol, developed end to end with an agentic harness.

## 1. Why this project exists

Two goals, equally important:

1. **Product goal:** show how an AI agent can live _inside_ a frontend, not next to it: streaming responses, the agent operating the UI through frontend tool calls, shared state between agent and editor, and human-in-the-loop approval of every change.
2. **Engineering goal:** build the whole codebase with a coding agent (Claude Code) inside a deliberate **harness**: context files, skills, a knowledge base, and automated sensors (types, lint, tests, accessibility, AI review) that keep the agent's output at production quality. The harness is a first-class deliverable and is documented in the README.

The finished project should be demoable in 3 minutes and explainable in a 30-minute technical interview.

## 2. Non-goals

- Not a full CMS. No multi-tenant auth, roles, publishing workflow, media library, or versioned content model.
- Not a chat app with an editor bolted on. The agent's value is acting on the document, not chatting.
- No high-scale infrastructure. One server process, one small database.
- No vendor lock-in beyond the model provider: the agent layer talks to the UI through AG-UI, so the agent framework could be swapped.

## 3. User and core scenario

A content editor writes an article in a rich-text editor. A side panel holds the agent. The editor asks things like:

- "Tighten the second paragraph."
- "Write a meta description and suggest three tags."
- "Is this article accessible?"
- "Give me an SEO title under 60 characters."

The agent reads the current document, then **proposes** changes. Every change appears as a reviewable diff or field suggestion. The editor accepts or rejects each one. Nothing changes the document without approval.

## 4. Features

### MVP (must have)

1. **Document list and editor:** create, open and save articles. Fields: title, slug, body (rich text), summary, meta description, tags.
2. **Agent side panel with streaming:** messages stream token by token; tool activity is shown inline ("Reading document…", "Proposing an edit…").
3. **Shared state:** the agent always sees the current editor state (fields and body) without the user pasting it.
4. **Frontend tool calls:** the agent can call tools that run in the browser:
   - `proposeFieldValue(field, value, reason)` — suggests a value for one of the host's fields (here: title, summary, meta description, tags or slug). `value` is a string, or a string array for tags.
   - `proposeBodyEdit(blockId, newContent, reason)` — suggests a replacement for one block of the body.
5. **Human-in-the-loop approval:** each proposal renders as a card with a diff (old vs new) and Accept / Reject buttons. Accepting applies the change **to the editor** (saving stays the user's action) and the agent is told the result. Rejecting can include an optional reason that goes back to the agent. If the target block changed since the proposal was made, the card shows it as stale and Accept is disabled.
6. **Persistence:** documents are saved to the server.

### Phase 2 (should have)

7. **Accessibility check:** an `a11yCheck` server tool runs axe-core (or equivalent structural checks) on the rendered article and the agent explains issues and proposes fixes (missing alt text, skipped heading levels, vague link text).
8. **SEO check:** an `seoCheck` server tool computes title length, meta description length, heading structure and keyword presence; the agent proposes fixes.
9. **Undo:** accepted changes can be undone.

### Phase 3 (nice to have)

10. **Batch review:** the agent proposes several edits at once; the user reviews them as a list.
11. **Tone presets:** "more formal", "shorter", "friendlier" quick actions.
12. **Deployed demo** with a seeded sample article and rate limiting.

## 5. Architecture

pnpm monorepo, TypeScript strict everywhere.

```
margin/
├── apps/
│   ├── web/      React 18 · Vite · TypeScript · TipTap editor (implements EditorHost)
│   └── server/   Node · Fastify · AI SDK agent (AG-UI endpoint) · REST for documents · SQLite
├── packages/
│   ├── agent-panel/  Host-agnostic React agent panel (AG-UI wiring, proposal cards, diff view)
│   └── shared/       Types, zod schemas for documents and agent tools, pure helpers (diffing, validation)
├── plugins/          Later: strapi/, wordpress/ (Phases 4–5)
├── docs/         Knowledge base (see §8)
├── e2e/          Playwright tests
├── CLAUDE.md
└── SPEC.md
```

### Decided choices (Phase 0, see `docs/adr/`)

- **Editor:** TipTap v3 with the UniqueID extension (ADR 0001).
- **AG-UI client:** the raw `@ag-ui/client` SDK with our own hooks, no CopilotKit (ADR 0002).
- **Agent runtime:** Vercel AI SDK with the Anthropic provider, plus our own AG-UI event adapter (ADR 0003).
- **Server:** Fastify only (ADR 0004).
- **Storage:** SQLite via better-sqlite3 + Drizzle (ADR 0005).
- **Testing:** Vitest (unit), Playwright (e2e), axe-core (a11y), ESLint + typescript-eslint, Prettier.
- **Versions:** pinned in ADR 0007. Check current documentation before changing them.

### Host-agnostic design (plan for CMS plugins from day one)

The agent panel must not depend on our own editor. It lives in its own package and talks to whatever editor hosts it through a small adapter interface:

```ts
interface EditorHost {
  getSchema(): FieldDescriptor[]; // which fields this host has (name, label, kind, maxLength)
  getState(): DocumentState; // field values + host-neutral body, for AG-UI shared state
  subscribe(onChange: (s: DocumentState) => void): () => void;
  applyFieldValue(field: FieldName, value: FieldValue): Promise<void>; // FieldValue = string | string[]
  applyBodyEdit(blockId: string, block: BodyBlockContent): Promise<void>;
  getAuthToken(): Promise<string>; // short-lived token for the agent server
}
```

Rules that keep this portable (ADR 0006):

- **Host-neutral body.** `DocumentState.body` is `BodyBlock[]` (`{ blockId, type, text, attrs? }`, inline marks as Markdown). Each host converts to and from its own format. TipTap JSON never leaves `apps/web`.
- **Session-scoped block ids.** `blockId` is opaque and only stable for the editing session (Strapi Blocks have no ids; Gutenberg ids are not saved). Each body proposal records a `baseHash` of the block's text; a mismatch on Accept marks it stale.
- **Fields come from the host.** `FieldName` is a string checked against `getSchema()`. Hosts map tags to their own ids.
- **Accept applies to the editor, not to storage.** Saving stays with the host.
- **Scoped styles.** The panel uses prefixed class names and no global CSS. Focus after Accept/Reject stays inside the panel.

Package layout becomes:

- `packages/agent-panel`: the React side panel, proposal cards, diff view and AG-UI wiring. Knows nothing about TipTap, Strapi or WordPress.
- `packages/shared`: schemas and types (unchanged).
- `apps/web`: the standalone demo, where TipTap implements `EditorHost`.
- Later: `plugins/strapi` and `plugins/wordpress`, each implementing `EditorHost` for that CMS.

The agent server is shared by every host. Each host only needs its URL and a way to get a short-lived token (`getAuthToken`). In a CMS, the CMS backend proxies or mints that token; the model key and any long-lived secret never reach the browser.

### Data model

`Document { id, title, slug, summary, metaDescription, tags[], body (TipTap JSON with UniqueID block ids), updatedAt }`

Stored `body` is the demo editor's format. What the agent and the panel see is the host-neutral `BodyBlock[]` derived from it.

### Agent design

- **System prompt:** role, rules ("never invent facts about the article's subject; propose, don't overwrite; explain every proposal in one sentence").
- **Context:** current document state via AG-UI shared state.
- **Frontend tools:** `proposeFieldValue`, `proposeBodyEdit` (schemas in `packages/shared`).
- **Server tools:** `a11yCheck`, `seoCheck` (Phase 2).
- **Interrupts:** every proposal waits for the user's Accept / Reject before the agent continues.

## 6. Security and cost rules

- The model API key lives only on the server. Never in the client bundle, never in logs. CMS hosts never ship a long-lived key to the browser; the panel gets a short-lived token through `EditorHost.getAuthToken()`.
- Validate every tool call payload against its zod schema on both ends.
- Cap tokens per request and requests per minute.
- The deployed demo must not accept arbitrary large documents.

## 7. Milestones and acceptance criteria

**Phase 0 — Harness and skeleton (week 1)**

- Monorepo, strict TS, lint, format, Vitest, Playwright, CI (GitHub Actions) all green on an empty app.
- CLAUDE.md, docs/ structure, first ADRs (editor, agent framework, AG-UI client, storage).
- At least two project skills written (see §8).
- Done when: `pnpm check` runs typecheck + lint + unit tests + e2e smoke test and passes in CI.

**Phase 1 — MVP (weeks 2–3)**

- Features 1–6.
- Done when: an e2e test opens an article, asks the agent for a meta description, sees a proposal card, accepts it, and the field is saved. A second test rejects a proposal and confirms nothing changed.

**Phase 2 — Checks and polish (week 3–4)**

- Features 7–9, keyboard-accessible proposal cards, focus management after accept/reject, axe passes on all screens.

**Phase 3 — Showcase (week 4)**

- Deployed demo, 2–3 minute video, README with the harness write-up.

**Phase 4 — Strapi plugin (after the showcase)**

- A Strapi 5 plugin that adds the agent panel to the Content Manager edit view, implementing `EditorHost` on top of Strapi's form state.
- Done when: in a local Strapi project with a sample content type, the agent proposes a meta description, the editor accepts it, and the Strapi entry shows the new value after saving.

**Phase 5 — WordPress plugin (optional)**

- A WordPress plugin that adds the agent panel as a block-editor (Gutenberg) sidebar, implementing `EditorHost` on top of the editor's data store.

Phases 4–5 must not start until Phase 3 is shipped. Only the `EditorHost` boundary is required early.

## 8. The harness (deliverable, not decoration)

### Guides (before the agent acts)

- **CLAUDE.md:** rules, commands, definition of done, architecture boundaries.
- **docs/architecture.md:** module boundaries and data flow (agent ↔ AG-UI ↔ editor).
- **docs/adr/:** one short Architecture Decision Record per real decision.
- **docs/domain.md:** glossary (document, block, proposal, field, interrupt).
- **Skills** (e.g. `.claude/skills/`):
  - `add-agent-tool`: how to add a tool end to end (shared schema → server or client handler → proposal UI → tests).
  - `add-document-field`: how to add a field (schema → DB migration → editor UI → agent awareness → tests).
  - `write-e2e-test`: conventions for Playwright tests, including mocking the model.

### Sensors (after the agent acts)

- Typecheck (strict), ESLint with rules that encode our boundaries (e.g. `apps/web` may not import server code), Prettier.
- Unit tests for shared schemas and diff helpers.
- Playwright e2e with a **mocked model** so tests are deterministic.
- axe-core accessibility checks in e2e.
- An AI review step on pull requests (a reviewer prompt that checks against CLAUDE.md rules).
- Error messages from custom checks are written so an agent can fix the problem from the message alone.

### Steering loop

- `docs/harness-log.md`: every time the agent makes the same kind of mistake twice, record it and the guide or sensor added to prevent it. This log is evidence for interviews.

## 9. Resume line (target)

> **AI-assisted content editor** (React, TypeScript, AG-UI, Claude API): an in-editor agent that rewrites content, fills fields through frontend tool calls and shares editor state, with human-in-the-loop approval of every change. Built end to end with an agentic harness: context files, project skills, a knowledge base, and typed, tested, accessibility-checked CI with AI review.

## 10. Open questions (decide in Phase 0)

- ~~CopilotKit components vs. raw AG-UI client~~ → raw client (ADR 0002).
- ~~Which agent framework~~ → AI SDK + own AG-UI adapter (ADR 0003).
- Hosting for the demo (a host that supports a long-lived Node server and SQLite, or switch storage).
