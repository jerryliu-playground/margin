# 0007. Toolchain and pinned versions

- Status: Accepted
- Date: 2026-10-21

## Context

CLAUDE.md requires every new dependency to be recorded in an ADR. Versions were checked against the npm registry on 2026-10-21.

## Decision

Pin exact versions (no `^`) for runtime and tooling.

| Area            | Package                                                             | Version                       | Note                                                                 |
| --------------- | ------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| Package manager | pnpm                                                                | 12.14.0                       | via `packageManager`                                                 |
| Runtime         | Node                                                                | 24 LTS                        | `.nvmrc`                                                             |
| Language        | typescript                                                          | 6.0.3                         | not 7.x: `typescript-eslint` 8.72 supports `<6.1`                    |
| UI              | react, react-dom                                                    | 18.3.1                        | matches Strapi 5 and WordPress hosts; panel peer is `^18.3 \|\| ^19` |
| Build           | vite / @vitejs/plugin-react                                         | 8.3.4 / 6.1.2                 | 8.3.5 was under a day old (see below)                                |
| Editor          | @tiptap/react, core, pm, starter-kit, extension-unique-id, markdown | 3.32.0                        | ADR 0001                                                             |
| AG-UI           | @ag-ui/client, core, encoder                                        | 1.0.3                         | ADR 0002/0003                                                        |
| Agent           | ai / @ai-sdk/anthropic                                              | 7.0.143 / 4.0.82              | ADR 0003; older than the newest on purpose (see below)               |
| Server          | fastify, @fastify/cors, @fastify/rate-limit, @fastify/sse           | 5.12.7, 11.3.1, 11.2.1, 0.6.1 | ADR 0004                                                             |
| Storage         | drizzle-orm, drizzle-kit, better-sqlite3                            | 0.45.4, 0.31.11, 13.0.3       | ADR 0005                                                             |
| Schemas         | zod                                                                 | 4.6.7                         |                                                                      |
| Tests           | vitest, @playwright/test, @axe-core/playwright, jsdom               | 5.0.5, 1.64.1, 4.14.0, 30.1.3 | jsdom for editor unit tests                                          |
| Lint/format     | eslint, typescript-eslint, prettier                                 | 10.13.0, 8.72.0, 3.9.10       |                                                                      |
| Dev             | tsx                                                                 | 4.23.15                       | runs the server in dev                                               |
| Types           | @types/node, @types/react, @types/react-dom                         | 24.19.2, 18.3.31, 18.3.7      | match Node 24 and React 18                                           |
| Lint plugins    | @eslint/js, eslint-plugin-react-hooks, globals                      | 10.0.1, 7.1.1, 17.13.0        | used by `eslint.config.js`                                           |
| Test types      | @ai-sdk/provider (server dev)                                       | 4.0.31                        | stream-part types for the mock model; must match `ai`'s own dep      |

**Supply-chain policy.** pnpm 12 refuses packages published less than a day ago (`minimumReleaseAge`). We keep the policy and pick a slightly older version instead of adding `minimumReleaseAgeExclude` entries. Only `esbuild` may run install scripts (`allowBuilds` in `pnpm-workspace.yaml`).

**TypeScript flags.** `apps/server` turns off `exactOptionalPropertyTypes`, because the AI SDK's `ToolSet` types reject valid tools with it on. Every other package keeps it.

Phase 0 installs only what the skeleton uses; the rest is added when its first feature lands, at the version above unless a newer ADR says otherwise.

## Consequences

- Upgrades are deliberate: bump the version here and in `package.json` in the same change.
- TypeScript 7 waits for `typescript-eslint` support.
