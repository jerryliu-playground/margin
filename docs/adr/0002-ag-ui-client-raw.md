# 0002. AG-UI client: raw `@ag-ui/client`, no CopilotKit

- Status: Accepted
- Date: 2026-10-21

## Context

The agent panel (`packages/agent-panel`) must run in our demo, a Strapi 5 admin plugin and a Gutenberg sidebar, all React 18. We build our own UI. The protocol should stay visible enough to explain in an interview.

CopilotKit v2 (`@copilotkit/react-core` 1.79.1) offers `useHumanInTheLoop`, `useFrontendTool` and `useAgent`, but:

- it needs its own `CopilotRuntime` on the server, or a licensed `selfManagedAgents` setup / an `agents__unsafe_dev_only` option to talk to a plain AG-UI endpoint;
- the headless entry is about 194 KB gzip (full entry about 3.4 MB) and ships global CSS variables;
- it pins its own `@ag-ui/client`, so we would carry two copies.

## Decision

Use `@ag-ui/client` 1.0.3 directly (`HttpAgent`, subscribers). `packages/agent-panel` owns:

- small React hooks over the agent (`useSyncExternalStore`);
- a pending-proposal registry keyed by `toolCallId`;
- the approval round trip: on Accept/Reject, append a `{ role: "tool", toolCallId, content }` message and start a new run.

## Consequences

- Easy: no React peer from the client, about 98 KB gzip, every event is explicit and testable with a fake event stream.
- Harder: we write and test roughly 200–400 lines of glue.
- Watch: the "tool result goes back in a new run" pattern is inferred from the API, not stated in the docs. A spike test in `apps/server` proves it (see ADR 0003).

## Alternatives considered

- **CopilotKit hooks**: faster to start, but hides the protocol, adds a runtime or licence question and heavy deps inside CMS hosts.

Sources: https://docs.ag-ui.com/concepts/tools, https://docs.ag-ui.com/sdk/js/client/subscriber, https://docs.copilotkit.ai/backend/self-managed-agents.
