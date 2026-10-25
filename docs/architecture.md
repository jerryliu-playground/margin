# Architecture

How the pieces fit and which way data flows. Decisions behind this live in [adr/](adr/README.md).

## Packages and boundaries

```
apps/web ──────────► packages/agent-panel ──► packages/shared
   │  (TipTap host)        (React panel)          (zod schemas, types,
   │                                                pure helpers, no I/O)
   └──────── HTTP / SSE ────────► apps/server ───► packages/shared
                                  (Fastify, agent, SQLite)
```

| Package                 | May import                            | Must never import                                                                |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/agent-token`  | `node:crypto`                         | anything in `apps/*`; it must never be imported by browser code                  |
| `packages/shared`       | `zod`                                 | anything in `apps/*` or `packages/agent-panel`; any I/O (`node:fs`, `fetch`, DB) |
| `packages/agent-panel`  | `shared`, React, `@ag-ui/client`      | `@tiptap/*`, Strapi, WordPress, `apps/*`                                         |
| `apps/web`              | `shared`, `agent-panel`, TipTap       | `apps/server`                                                                    |
| `apps/server`           | `shared`, Fastify, AI SDK             | `apps/web`, `packages/agent-panel`                                               |
| `plugins/strapi` admin  | `shared`, `agent-panel`, Strapi admin | `apps/*`, `agent-token`, its own `server/`                                       |
| `plugins/strapi` server | `shared`, `agent-token`               | `apps/*`, `agent-panel`, its own `admin/`                                        |

These rules are enforced by ESLint (`no-restricted-imports` in `eslint.config.js`). Each error message says which rule from CLAUDE.md it protects and what to do instead.

Test helpers (fakes, test apps, sample requests) live in each package's `src/testing/`. Only `*.test.ts(x)` files and other `testing/` files may import them; ESLint rejects the import anywhere else. Unit tests sit next to the code they test; e2e tests live in `e2e/`.

## Agent round trip (AG-UI)

```
Panel (browser)                          Server
──────────────                           ──────
HttpAgent.runAgent({ tools, state }) ──► POST /agent  (RunAgentInput, zod-validated)
                                         streamText(model, tools without execute)
          ◄── SSE: RUN_STARTED, TEXT_MESSAGE_*, TOOL_CALL_START/ARGS/END, RUN_FINISHED
render proposal card (pending)
user clicks Accept / Reject
EditorHost.applyFieldValue / applyBodyEdit   (Accept only)
append { role: "tool", toolCallId, content } and runAgent again ──► agent continues
```

- **Shared state:** the panel sends `{ schema: EditorHost.getSchema(), document: EditorHost.getState() }` (`AgentState`) as `RunAgentInput.state` on every run. The server never writes state back in the MVP.
- **Editor context:** things the user did that the history cannot show (undos) travel as AG-UI `context` on the next run: one entry, description `Editor events since your last turn`, value a JSON list of structured events (`editorEventSchema`). The server writes the sentences itself, so no client text reaches the system prompt. Events are cleared only after a run succeeds.
- **Request contract:** `agentRunRequestSchema` in `packages/shared/src/agent.ts` is the subset of AG-UI `RunAgentInput` we accept. Clients cannot send `system` or `developer` messages; the server owns the system prompt.
- **Frontend tools:** `proposeFieldValue`, `proposeBodyEdit`. Defined in `packages/shared`, sent as `RunAgentInput.tools`, never executed on the server.
- **Server tools:** `a11yCheck`, `seoCheck` (pure checks in `packages/shared/src/checks.ts`). Always available, executed on the server on this run's document state. The call streams as `TOOL_CALL_START/ARGS/END`, the result as `TOOL_CALL_RESULT`, and the model continues in the same run (each model step is its own assistant message). The panel never answers them.
- **Interrupt:** a run ends at an unanswered frontend tool call. The next run starts when the user answers.

## Server agent (apps/server/src/agent)

| File            | Role                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------- |
| `routes.ts`     | `POST /agent`: validates `agentRunRequestSchema`, rejects unknown tools, streams SSE     |
| `run.ts`        | AI SDK `streamText` parts → AG-UI events (the adapter, ADR 0003)                         |
| `messages.ts`   | AG-UI messages → AI SDK messages; closes unanswered tool calls as rejected               |
| `prompt.ts`     | System rules, then the field list and document as JSON                                   |
| `model.ts`      | Picks Claude (`MARGIN_MODEL=anthropic`) or the scripted mock; the only reader of the key |
| `mock-model.ts` | Deterministic script for tests and offline dev                                           |

## Agent panel (packages/agent-panel/src)

| File                                  | Role                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `agent-session.ts`                    | AG-UI client session: runs, streaming, activity, proposal registry, Accept/Reject, auto-continue    |
| `checks.ts`                           | Finds server check results (tool messages) in the conversation for the issue list                   |
| `proposals.ts`                        | Tool call → proposal (validated against shared schemas and `getSchema()`), stale check, tool result |
| `AgentPanel.tsx` / `ProposalCard.tsx` | UI; focus moves to the next pending card or the message box after an answer                         |
| `testing/fake-agent.ts`               | Test doubles: scripted AG-UI agent and in-memory `EditorHost`                                       |

Theming: the panel's colours, radii and fonts are CSS custom properties (`--margin-*`) in `tokens.css`, declared with zero specificity. A host themes the panel by setting them on `.margin-panel`; the demo app maps its own tokens (`apps/web/src/tokens.css`) this way. The host also decides the panel's height: given one, the conversation scrolls and the message box stays at the bottom.

Approval rules the session enforces:

- A turn's proposals are answered together: the next run starts when every tool call of the turn has an answer.
- An invalid tool call is never shown; it is answered `rejected` with the validation error. More than two all-invalid turns in a row stop with an error.
- A body proposal whose block changed (hash differs from `baseHash`) cannot be accepted; dismissing it answers `stale`.
- Accept all / Reject all (shown when two or more proposals are pending) answer each pending proposal through the same accept/reject path, so outdated ones become `stale` and the run continues once.
- Undo restores the value from before the proposal, only if the field value or the block's hash is unchanged since Accept (`canUndo` in `proposals.ts`). The next run tells the agent, once, through AG-UI `context` as a structured event (see Editor context above).

## Strapi plugin (plugins/strapi, ADR 0010)

```
Strapi admin (browser)                    Strapi server            Margin server
side panel → AgentPanel + Strapi host
  host.getAuthToken() ── POST /margin/token ─► signs a token
                                               (iss "strapi", sub = admin id)
  runAgent ──────────────── POST /agent (CORS: CMS_ORIGINS) ──────────────► same flow as the demo
```

| File (admin/src)  | Role                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `MarginPanel.tsx` | `addEditViewSidePanel` entry; only for content types in the plugin config                                         |
| `blocks.ts`       | Blocks ⇄ host-neutral body: inline Markdown, whole-Markdown lists/quotes/code, images as `![alt](url)` (alt only) |
| `fields.ts`       | content type attributes → fields: text, textarea, uid, and one level of single components (`seo.…`)               |
| `strapi-host.ts`  | `EditorHost` on the form values; a component field replaces the whole component through `onChange`                |
| `strapi-form.ts`  | the only file that imports Strapi admin hooks (`useForm`, `unstable_useContentManagerContext`)                    |
| `strapi-theme.ts` | Strapi's design system colours (light or dark) mapped onto the panel tokens; border, radius, height cap           |
| `token.ts`        | caches agent tokens until a minute before they expire                                                             |

The panel renders inside Strapi's edit `<form>`, so it uses no `<form>` of its own. `examples/strapi` is the local project for development (`pnpm dev:strapi`) and for `pnpm e2e:strapi`.

## Public demo protection (apps/server/src/demo.ts)

- Per-IP rate limits on every route (`@fastify/rate-limit`); behind a proxy `TRUST_PROXY=true` makes them see the real client IP.
- A global cap on agent runs per UTC day (`DAILY_AGENT_RUN_LIMIT`), answered with a plain 429 that the panel shows as is.
- A cap on stored documents (`MAX_DOCUMENTS`), and an optional nightly reset to the seeded article (`DEMO_RESET_HOUR_UTC`).

## Auth

The panel never holds the model key. It calls `EditorHost.getAuthToken()` and sends the token as a bearer header. The server holds the model key from environment variables (ADR 0006).

Tokens are signed and checked by `packages/agent-token` (Node only, ESLint keeps it out of browser code): a 15-minute HMAC token whose claims say which host asked (`iss`) and for which user (`sub`). The demo's `POST /auth/token` issues `iss: "demo"`; a CMS backend issues its own with the same secret (ADR 0010). A token whose `iss` is not `demo` works only for `POST /agent`, and CORS allows the origins in `CMS_ORIGINS` for that route only.

## Document model

`Document { id, title, slug, summary, metaDescription, tags[], body, updatedAt }` in storage. `body` is TipTap JSON in `apps/web`, and `BodyBlock[]` everywhere the agent can see it.
