# 0005. Storage: SQLite via better-sqlite3 + Drizzle

- Status: Accepted
- Date: 2026-10-21

## Context

One server process, one small database, typed queries, migrations checked into the repo.

## Decision

- `better-sqlite3` 13.0.3 as the driver, `drizzle-orm` 0.45.4 for typed queries, `drizzle-kit` 0.31.11 for migrations.
- Stay on Drizzle 0.45 (`latest`). `1.0.0-rc` exists; moving to 1.0 needs a new ADR.
- Tests use an in-memory database (`:memory:`).
- Phase 0 records the decision only. The packages, connection helper and documents table arrive together in Phase 1, where `better-sqlite3` must be allowed to run its install script (`allowBuilds` in `pnpm-workspace.yaml`).

## Consequences

- Easy: zero-ops database, fast tests.
- Watch: `better-sqlite3` is a native module, so CI and the demo host need a matching prebuilt binary or a build toolchain. Demo hosting stays an open question (SPEC §10).

## Alternatives considered

- **libsql / Turso**: useful for hosted demos, adds a network dependency we don't need yet.
- **Postgres**: more than one small database needs.
