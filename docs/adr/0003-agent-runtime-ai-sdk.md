# 0003. Agent runtime: Vercel AI SDK + hand-written AG-UI adapter

- Status: Accepted
- Date: 2026-10-21
- Note: SPEC.md suggested Mastra; this ADR replaces that suggestion.

## Context

The server agent uses Claude, calls frontend tools defined by the client, later calls server tools (`a11yCheck`, `seoCheck`), reads shared state, and stops at every proposal until a human answers. E2E tests need a deterministic mocked model. AG-UI is the boundary, so the framework must be swappable.

Findings (2026-10-21):

- `@ag-ui/mastra` 2.0.1 works but pins `zod ^3.25` (we use Zod 4), requires `@copilotkit/runtime` as a peer, and has open bugs: last tool call lost when the first suspends (#3136), tool calls parented to the wrong message (#3130), cut-off turns look finished (#2877).
- `@ag-ui/langgraph` is 0.0.x with open frontend-tool bugs.
- `@ag-ui/claude-agent-sdk` lacks human-in-the-loop interrupts and targets coding agents.
- `@ag-ui/vercel-ai-sdk` is not published to npm.
- The AI SDK has first-class Claude support and `MockLanguageModelV4` in `ai/test`.

## Decision

- `ai` 7.0.143 + `@ai-sdk/anthropic` (version per ADR 0007) run the model loop with `streamText`.
- Frontend tools from `RunAgentInput.tools` become AI SDK tools **without `execute`**, so the stream stops at the tool call.
- Our adapter in `apps/server/src/agent/` maps AI SDK stream parts to `@ag-ui/core` events and encodes them with `@ag-ui/encoder`.
- Server tools are ordinary AI SDK tools with `execute`.
- Tests inject `MockLanguageModelV4`; no test calls the real API (CLAUDE.md rule 5).

## Consequences

- Easy: the protocol mapping is our code and fully visible; model swap is one line; no CopilotKit or Mastra storage.
- Harder: we own event ordering, retries and edge cases (several tool calls in one turn).
- Watch: `ai` releases almost daily. Pin exact versions and update on purpose.

## Alternatives considered

- **Mastra + `@ag-ui/mastra`**: most complete off the shelf, but Zod 3 pin, CopilotKit peer and open bridge bugs.
- **LangGraph.js**: strong state model, immature TS AG-UI bridge.
- **Raw `@anthropic-ai/sdk`**: full control, but no mock model; 1.0.0 was released the same day.

Sources: https://docs.ag-ui.com/integrations, https://github.com/ag-ui-protocol/ag-ui/issues/2874, /3136, /3130, /2877.
