---
name: add-agent-tool
description: Add a new agent tool to Margin end to end (shared zod schema, frontend or server handler, proposal UI, tests). Use whenever a task adds or changes a tool the agent can call, such as proposeFieldValue, proposeBodyEdit, a11yCheck or seoCheck.
---

# Add an agent tool

Read `docs/architecture.md` (agent round trip) and ADR 0003 first. Decide the kind:

- **Frontend tool**: runs in the browser and changes the document only after the user accepts (`proposeFieldValue`, `proposeBodyEdit`). Never executed on the server.
- **Server tool**: runs on the server and returns data to the agent (`a11yCheck`, `seoCheck`). It must never change the document.

## Steps

1. **Schema (packages/shared/src/tools.ts).**
   - Add a zod schema for the arguments. Every field gets `.describe()`; it becomes the JSON Schema the model sees.
   - Frontend tools: add an entry to `frontendTools` (name, description, args). Every frontend tool has a `reason` argument (CLAUDE.md hard rule 1: explain every proposal).
   - Use domain names from `docs/domain.md`.
2. **Unit test the schema** in `packages/shared/src/tools.test.ts`: one valid payload, one missing required field, one edge case (too long, wrong type).
3. **Handler.**
   - Frontend tool: the server passes it to `streamText` **without `execute`** (see `apps/server/src/agent/tool-round-trip.spike.test.ts` for the pattern). The panel validates the call's arguments with the same schema before showing anything. Invalid arguments are answered with an error tool result, never shown as a proposal.
   - Server tool: an AI SDK `tool({ inputSchema, execute })` in `apps/server/src/agent/`. Validate input with the shared schema; return plain JSON.
4. **Proposal UI (frontend tools only, packages/agent-panel).** Extend `parseProposal` in `proposals.ts` (validation and the "before" value), then render it in `ProposalCard.tsx`; the session (`agent-session.ts`) already handles batching, answers and focus.
   - A card with old vs new, the reason, and Accept / Reject buttons with accessible names.
   - Accept calls the matching `EditorHost` method, never the editor directly (CLAUDE.md rule 7).
   - Body proposals carry `baseHash`; if the block changed, show the card as stale and disable Accept.
   - After Accept or Reject, move focus to the next pending card, or to the message input if none is left.
   - The answer goes back as a tool message using `proposalResultSchema`.
5. **Tests.**
   - Server: `runAgent` with a scripted model (`run.test.ts` pattern; every event is checked against the AG-UI `EventSchema`), and add a keyword to the mock script in `mock-model.ts` for e2e. Never call the real model.
   - Panel: drive the session with `FakeAgent` / `fakeHost` from `packages/agent-panel/src/testing/fake-agent.ts` (`agent-session.test.ts` pattern). Server tests use `testApp` / `testRequest` from `apps/server/src/testing/`.
   - E2E: follow the `write-e2e-test` skill. One test for Accept (value applied), one for Reject (nothing changed). Include an axe check on the card.
6. **Docs.** Add the tool to `docs/architecture.md` (tool list) and, if it introduces a new term, to `docs/domain.md`.
7. Run `pnpm check`.

## Don'ts

- No tool may write to storage or the editor without a user Accept.
- No tool schema defined outside `packages/shared`.
- No host-specific code (TipTap, Strapi, WordPress) in `packages/agent-panel`.
