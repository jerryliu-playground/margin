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

| Package                | May import                       | Must never import                                                                |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| `packages/shared`      | `zod`                            | anything in `apps/*` or `packages/agent-panel`; any I/O (`node:fs`, `fetch`, DB) |
| `packages/agent-panel` | `shared`, React, `@ag-ui/client` | `@tiptap/*`, Strapi, WordPress, `apps/*`                                         |
| `apps/web`             | `shared`, `agent-panel`, TipTap  | `apps/server`                                                                    |
| `apps/server`          | `shared`, Fastify, AI SDK        | `apps/web`, `packages/agent-panel`                                               |

These rules are enforced by ESLint (`no-restricted-imports` in `eslint.config.js`). Each error message says which rule from CLAUDE.md it protects and what to do instead.

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
- **Request contract:** `agentRunRequestSchema` in `packages/shared/src/agent.ts` is the subset of AG-UI `RunAgentInput` we accept. Clients cannot send `system` or `developer` messages; the server owns the system prompt.
- **Frontend tools:** `proposeFieldValue`, `proposeBodyEdit`. Defined in `packages/shared`, sent as `RunAgentInput.tools`, never executed on the server.
- **Server tools (Phase 2):** `a11yCheck`, `seoCheck`. Executed on the server, results stream as tool-call events.
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

## Auth

The panel never holds the model key. It calls `EditorHost.getAuthToken()` and sends the token as a bearer header. The server holds the model key from environment variables (ADR 0006).

## Document model

`Document { id, title, slug, summary, metaDescription, tags[], body, updatedAt }` in storage. `body` is TipTap JSON in `apps/web`, and `BodyBlock[]` everywhere the agent can see it.
