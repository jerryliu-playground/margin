# 0004. Server: Fastify only, no Mastra server

- Status: Accepted
- Date: 2026-10-21

## Context

The server exposes an AG-UI endpoint and REST for documents, with rate limiting, token caps, zod validation, CORS for other hosts' origins, and no secret or prompt logging in production. The owner knows Fastify. ADR 0003 removed Mastra as the agent framework.

## Decision

One Fastify 5 process (`apps/server`):

- `POST /agent`: body validated as AG-UI `RunAgentInput`, events streamed as SSE through `@fastify/sse`.
- `/documents` REST routes.
- `@fastify/cors`, `@fastify/rate-limit`, and an auth hook shared by all routes.
- Logger redaction for auth headers and message content in production.
- Tests use `app.inject()`.

## Consequences

- Easy: one place for auth, limits and validation; familiar testing.
- Watch: `@fastify/sse` is 0.6.1 (pre-1.0). If it breaks, fall back to `reply.raw` with `@ag-ui/encoder`.

## Alternatives considered

- **Mastra built-in server (Hono)**: would move documents CRUD and limits into Mastra's build pipeline.
- **`@mastra/fastify` adapter**: mounts Mastra's own stream format, not AG-UI; moot once ADR 0003 dropped Mastra.

Sources: https://mastra.ai/docs/server/server-adapters, https://github.com/fastify/sse.
