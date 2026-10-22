# Phase 2 plan

Approved by the owner on 2026-10-22. One commit per step; each step passes `pnpm check` on its own. Do not push until the owner asks.

**Goal (SPEC §7):** features 7–9 (accessibility check, SEO check, undo), keyboard-accessible proposal cards, focus management after accept/reject, axe passes on all screens.

**Resuming:** compare the steps below with `git log --oneline`. Each step's commit subject starts with its tag (e.g. `P2.3`). Start at the first step without a commit and tick it here in the same commit.

## Decisions

1. **a11yCheck is structural, pure, in `packages/shared`.** Checks: skipped heading levels, empty headings, vague link text, images without alt. No axe-core on the server: jsdom has no layout, so contrast checks cannot run anyway.
2. **Image blocks.** TipTap Image extension as a block with an `alt` attribute; the seeded article gets one image without alt. No "insert image" UI in this phase (paste and seed only).
3. **Undo per accepted card.** Restores the value from before the proposal, only if it has not changed since; otherwise the card says it cannot be undone. Works for fields and blocks.
4. **AI review on PRs.** `anthropics/claude-code-action` pinned to `v1.0.257`, reviewing against CLAUDE.md. The owner adds the `ANTHROPIC_API_KEY` repository secret. After this step, changes land through branches and PRs.

## Steps

- [x] **P2.1 `add-document-field` skill** — schema → DB migration → editor UI → agent awareness → tests. `.claude/skills/add-document-field/SKILL.md`.
- [x] **P2.2 Check contracts and pure checks** — zod input/output schemas for `a11yCheck` and `seoCheck`, pure check functions, unit tests. `packages/shared`.
- [x] **P2.3 Image blocks** — Image extension (block, `alt`), BodyBlock round trip (`![alt](src)` or attrs), seed image without alt, jsdom tests. `apps/web`, `apps/server/src/documents/seed.ts`.
- [x] **P2.4 Server tools and multi-step runs** — tools with `execute` run on the server; results stream as `TOOL_CALL_RESULT`; the model continues in the same run (`stopWhen`); history with server tool calls converts correctly; mock-model scripts for "check accessibility" and "check SEO". Tests check every event against the AG-UI `EventSchema`. `apps/server`.
- [x] **P2.5 Panel shows checks** — activity "Checking accessibility…" / "Checking SEO…", a short issue list in the conversation; fixes still arrive as proposal cards. Unit + e2e. `packages/agent-panel`.
- [x] **P2.6 Undo** — "Undo" on accepted cards, guarded by "unchanged since accept", focus handled. Unit + e2e. `packages/agent-panel`.
- [x] **P2.7 Keyboard and axe everywhere** — one keyboard-only e2e (ask, tab to card, accept, undo); axe on every screen and every card state (pending, accepted, rejected, outdated, undone) and the 404 page; fix what it finds. `e2e/`.
- [x] **P2.8 AI review on PRs** — workflow, reviewer prompt from CLAUDE.md, ADR 0008; verify on one real PR (pending: needs the owner's secret and a pushed branch). `.github/workflows/`, `docs/adr/`.

## Risks to watch

- Multi-step runs: event order must pass the AG-UI client's verifier (text and tool calls closed before `RUN_FINISHED`).
- Server tool calls in history: the next run must convert them without inventing "unanswered" results.
- Image Markdown round trip: if `![alt](src)` does not survive, keep image data in `attrs`.
