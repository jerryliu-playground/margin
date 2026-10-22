# Margin

An article editor with an AI agent in a side panel. The agent reads the document, runs accessibility and SEO checks, and **proposes** changes; nothing changes until you accept. It talks to the UI through the [AG-UI protocol](https://docs.ag-ui.com): streamed text, shared editor state, and frontend tool calls that become proposal cards.

**Live demo:** https://margin-demo.fly.dev (resets to the sample article every day at 10:00 UTC; 300 agent runs per day)

The second goal of the project is the way it was built: end to end by a coding agent (Claude Code) inside a deliberate **harness** of guides, sensors and a steering loop. That harness is described [below](#the-harness).

## What it does

- **Proposals, never silent edits.** The agent suggests a field value or a block replacement. Each suggestion is a card with a word diff and the agent's one-sentence reason. Accept applies it to the editor; Reject can carry a reason back to the agent; Undo restores the previous value if nothing changed since.
- **Checks on the server.** `a11yCheck` (skipped heading levels, empty headings, vague link text, images without alt) and `seoCheck` (title and meta description length, slug, subheadings, keyword) run on the server; the agent reads the result and proposes fixes in the same run.
- **Batch review and tone presets.** Accept all / Reject all when a turn has several proposals; More formal / Shorter / Friendlier in one click.
- **Accessible.** Keyboard-only flow, focus moves to the next card or the message box, a live status line announces new proposals, axe passes on every screen and card state.
- **Host-agnostic panel.** The panel only knows an `EditorHost` interface, so the same panel can later run in a Strapi 5 admin plugin or a Gutenberg sidebar.

## Architecture

```
apps/web ──────────► packages/agent-panel ──► packages/shared
   (TipTap editor,       (React panel,             (zod schemas, pure checks,
    EditorHost)           raw @ag-ui/client)         no I/O)
        │
        └── HTTP + SSE ──► apps/server ──► packages/shared
                           (Fastify, AI SDK + Claude,
                            AG-UI adapter, SQLite)
```

| Package                | Role                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/shared`      | The contract: zod schemas for documents, the agent request, every tool and every API payload; pure checks and diff. |
| `packages/agent-panel` | The side panel: AG-UI session, proposal registry, cards, undo, batch review. Imports no editor code.                |
| `apps/web`             | The demo host: document list, TipTap v3 editor with stable block ids, `EditorHost` implementation.                  |
| `apps/server`          | Fastify: documents REST, short-lived tokens, rate limits, `POST /agent` streaming AG-UI events, server tools.       |

### One agent turn over AG-UI

1. The panel calls `HttpAgent.runAgent` with the frontend tools (`proposeFieldValue`, `proposeBodyEdit`) and the shared state: the host's field list plus the document as host-neutral blocks.
2. The server validates the request, runs Claude through the AI SDK, and maps stream parts to AG-UI events: `TEXT_MESSAGE_*`, `TOOL_CALL_START/ARGS/END`, `TOOL_CALL_RESULT` for server checks, `RUN_FINISHED`.
3. Frontend tools have no `execute` on the server, so the run ends at the proposal with `pendingToolCallIds`.
4. The user answers each card; the answers go back as `tool` messages in the next run, and the agent continues.

More in [`docs/architecture.md`](docs/architecture.md); every real decision is an ADR in [`docs/adr/`](docs/adr/README.md).

## The harness

The codebase was written by Claude Code. The harness is what kept that output at production quality, and it is a deliverable of the project, not decoration.

**Guides (before the agent acts)**

- [`CLAUDE.md`](CLAUDE.md): eight hard rules (approval first, schemas as the contract, secrets on the server, package boundaries, deterministic tests, accessibility, host-agnostic panel, one concern per commit), the commands, the definition of done.
- [`SPEC.md`](SPEC.md), [`docs/architecture.md`](docs/architecture.md), [`docs/domain.md`](docs/domain.md) (glossary), [ADRs 0001–0009](docs/adr/README.md), phase plans in [`docs/plans/`](docs/plans/).
- Skills in [`.claude/skills/`](.claude/skills/): `add-agent-tool`, `add-document-field`, `write-e2e-test`.

**Sensors (after the agent acts)**

- Strict TypeScript in every package; ESLint rules that encode the boundaries (the panel cannot import TipTap, shared cannot do I/O, production code cannot import test helpers), each with a message that says which rule it protects and what to do instead.
- Unit tests (Vitest), including a check of every agent event against the AG-UI `EventSchema` and the AG-UI client's own `verifyEvents` ordering rules.
- Playwright e2e against a scripted mock model (no test calls the real API), with axe on every screen and card state and a keyboard-only flow.
- CI: `pnpm check`, a production image build with a smoke test, and an AI review of every pull request against `CLAUDE.md` (ADR 0008).

**Steering loop**

When the agent makes the same kind of mistake twice, or the owner corrects the same thing twice, it goes into [`docs/harness-log.md`](docs/harness-log.md) together with the guide or sensor that prevents it. Examples from this project:

- Ambiguous e2e locators (the panel and the form share labels) → scoped `field()` / `panel()` helpers and a skill rule.
- Scripted edits that silently missed after Prettier reflowed text → assert every replacement; `verifyEvents` added as a sensor after one miss dropped a code path.
- The AI reviewer read "one concern per change" as "per pull request" → rule 8 clarified to "per commit", and the review prompt changed to judge commits.
- Fixes found while writing tests went into the test commit → the e2e skill now says to commit the fix first.

## Running it

Requirements: Node 24, pnpm 12.

```bash
pnpm install
pnpm dev        # web on http://localhost:5173, server on http://localhost:8790
pnpm check      # typecheck, lint, format check, unit tests, e2e
```

The server reads `apps/server/.env` in dev (see [`.env.example`](.env.example)). Without `MARGIN_MODEL=anthropic` and an `ANTHROPIC_API_KEY` it uses the scripted mock model, so everything works offline.

Deploying: [`docs/deploy.md`](docs/deploy.md) (Fly.io, one always-on machine, about $4/month).

## Stack

TypeScript (strict) · pnpm workspaces · React 18 + Vite · TipTap v3 · `@ag-ui/client` / `@ag-ui/core` · Vercel AI SDK + `@ai-sdk/anthropic` (Claude Haiku 5.5 by default) · Fastify 5 · SQLite (better-sqlite3 + Drizzle) · zod 4 · Vitest · Playwright + axe-core · ESLint + Prettier · GitHub Actions · Fly.io. Pinned versions and why: [ADR 0007](docs/adr/0007-toolchain-versions.md).
