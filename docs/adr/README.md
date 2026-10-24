# Architecture Decision Records

One short record per real decision. Never edit an accepted ADR's decision; supersede it with a new one.

| #                                        | Title                                                         | Status   |
| ---------------------------------------- | ------------------------------------------------------------- | -------- |
| [0001](0001-editor-tiptap.md)            | Editor: TipTap v3 with UniqueID                               | Accepted |
| [0002](0002-ag-ui-client-raw.md)         | AG-UI client: raw `@ag-ui/client`, no CopilotKit              | Accepted |
| [0003](0003-agent-runtime-ai-sdk.md)     | Agent runtime: Vercel AI SDK + hand-written AG-UI adapter     | Accepted |
| [0004](0004-server-fastify-only.md)      | Server: Fastify only, no Mastra server                        | Accepted |
| [0005](0005-storage-sqlite-drizzle.md)   | Storage: SQLite via better-sqlite3 + Drizzle                  | Accepted |
| [0006](0006-host-neutral-editor-host.md) | Host-neutral `EditorHost` and document model                  | Accepted |
| [0007](0007-toolchain-versions.md)       | Toolchain and pinned versions                                 | Accepted |
| [0008](0008-ai-review-on-prs.md)         | AI review on pull requests                                    | Accepted |
| [0009](0009-hosting-fly.md)              | Hosting the demo on Fly.io                                    | Accepted |
| [0010](0010-strapi-plugin.md)            | Strapi 5 plugin: side panel, token endpoint, workspace layout | Accepted |

## Template

```md
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context

What forces the decision. Facts, with sources.

## Decision

What we do.

## Consequences

What gets easier, what gets harder, what we must watch.

## Alternatives considered

Each option in one or two lines and why it lost.
```
