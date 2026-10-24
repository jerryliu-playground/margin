# CLAUDE.md — Margin

Read `SPEC.md` before starting any task. Read `docs/architecture.md` and the relevant ADRs before changing structure.

## What this project is

A rich-text content editor with an AI agent in a side panel. The agent talks to the UI through the AG-UI protocol: it streams responses, reads shared editor state, and proposes changes through frontend tool calls. **Every change needs human approval.** The codebase itself is built through a documented harness; keeping the harness healthy is part of every task.

## Stack (decided — do not change without an ADR)

- pnpm workspace monorepo · TypeScript strict in every package
- `apps/web`: React 18 + Vite, TipTap v3 editor implementing `EditorHost`
- `apps/server`: Node + Fastify, AI SDK agent (`ai` + `@ai-sdk/anthropic`) behind our own AG-UI adapter, REST for documents, SQLite (better-sqlite3 + Drizzle)
- `packages/agent-panel`: host-agnostic React panel on the raw `@ag-ui/client` SDK (no CopilotKit)
- `packages/shared`: types, zod schemas, pure helpers
- Decisions and pinned versions: `docs/adr/` (0001–0009); deploying: `docs/deploy.md`
- Tests: Vitest, Playwright, axe-core · Lint: ESLint + typescript-eslint · Format: Prettier

If a library's API is uncertain, check its current documentation instead of guessing. Record any new dependency in an ADR.

## Commands

```bash
pnpm install
pnpm dev          # web + server; the server reads apps/server/.env (e2e never does)
pnpm check        # typecheck + lint + format check + unit tests + e2e (must pass before you say a task is done)
pnpm typecheck    # tsc --noEmit in every package
pnpm lint         # ESLint (includes boundary rules) + raw colour check (scripts/check-colors.mjs)
pnpm format       # Prettier write (pnpm format:check to verify)
pnpm test         # unit tests (Vitest)
pnpm e2e          # Playwright (builds web, starts web + server with a mocked model)
pnpm --filter @margin/server db:generate   # new SQL migration after editing apps/server/src/db/schema.ts
docker build -t margin .                    # production image (CI builds and smoke-tests it)
```

Keep this list accurate; update it when scripts change.

## Hard rules

1. **Approval first.** The agent never writes to a document directly. Every change goes through a proposal → Accept/Reject flow.
2. **Schemas are the contract.** Every agent tool and every API payload has a zod schema in `packages/shared`. Validate on both client and server.
3. **Secrets stay on the server.** The model API key is read only in `apps/server` from environment variables. Never import server code into `apps/web`. Never log keys or full prompts with user content in production mode. The panel authenticates only with a short-lived token from `EditorHost.getAuthToken()`.
4. **Boundaries.** `apps/web` may import `packages/shared` but never `apps/server`. `packages/shared` imports nothing from `apps/*` and has no I/O.
5. **Deterministic tests.** E2E tests use a mocked model. No test may call the real model API.
6. **Accessibility is not optional.** Interactive elements are reachable by keyboard, have accessible names, and manage focus after actions (e.g. after Accept/Reject, focus moves to a sensible place). axe checks must pass.
7. **Host-agnostic panel.** `packages/agent-panel` must never import TipTap, Strapi or WordPress code. It only talks to the editor through the `EditorHost` interface defined in SPEC.md. Host-specific code lives in `apps/web` or `plugins/*`.
8. **Small, reviewable changes.** One concern per **commit**; each commit passes `pnpm check` on its own. A pull request may group several such commits that belong to one approved plan (e.g. a phase in `docs/plans/`). Don't refactor unrelated code in the same task.

## How changes land

On a branch, through a pull request. CI runs `pnpm check`, and the AI review (`.github/workflows/review.yml`, ADR 0008) comments against this file. Treat a repeated review comment like a repeated mistake: add a guide or sensor (see Harness upkeep).

## Definition of done

- [ ] `pnpm check` passes locally
- [ ] New behaviour has tests (unit for logic, e2e for user flows)
- [ ] New agent tools: schema in shared, handler, proposal UI, tests (use the `add-agent-tool` skill)
- [ ] Docs updated if structure or decisions changed (architecture.md, ADR, domain.md)
- [ ] No new lint suppressions without a comment explaining why

## Harness upkeep

- If you make the same kind of mistake twice, or the user corrects the same thing twice, add an entry to `docs/harness-log.md` and propose a guide (rule, doc, skill) or a sensor (lint rule, test, check) that prevents it.
- When a check fails, read its message fully before changing code. If a custom check's message was not enough to fix the problem, improve the message.

## Style

- Functional React components with hooks; no class components.
- Prefer explicit types at module boundaries; let inference work inside functions.
- Name things after the domain glossary in `docs/domain.md` (document, block, field, proposal, interrupt).
- User-facing copy is short and plain.
