# 0009. Hosting the demo on Fly.io

- Status: Accepted
- Date: 2026-10-22

## Context

SPEC §7 Phase 3 needs a public demo, and SPEC §10 left hosting open. The server is one long-lived Node process with SSE responses and a SQLite file on a persistent disk. Traffic is tiny (interviews), but the link is public, so cost must be capped.

Options checked on 2026-10-22: Fly.io (about $3.85/month always on, volumes), Railway Hobby ($5/month, volumes), Render (free tier has no disk; $7/month minimum), Koyeb (volumes in preview, not on free/eco), a self-managed VPS.

## Decision

- **Fly.io**, one `shared-cpu-1x` 512 MB machine, always on (`auto_stop_machines = "off"`, `min_machines_running = 1`), a 1 GB volume at `/data` for SQLite. Config in `fly.toml`; setup steps in `docs/deploy.md`.
- **One process, one origin:** the server serves the built web app (`MARGIN_WEB_DIST`) and the API, so production needs no CORS.
- **Image:** two-stage `Dockerfile`; the runtime runs the server's TypeScript through `tsx` (no compile step, the shared package is consumed as source). It runs as root because the Fly volume is root-owned.
- **Deploys:** a `deploy` job in CI runs `flyctl deploy --remote-only` on pushes to `main`, after the `check` and `image` jobs pass. The `setup-flyctl` action is pinned to a commit. Without the `FLY_API_TOKEN` secret it skips.
- **Public-demo protection:** `TRUST_PROXY`, a daily cap of 300 agent runs, 200 documents at most, a nightly reset to the seed, plus the owner's spend limit in the Anthropic Console.

## Consequences

- Easy: about $4/month, HTTPS and secrets handled by Fly, no cold start in demos.
- Watch: the volume lives on one machine (daily snapshots, no replication), so the app runs on exactly one machine, and each deploy has a few seconds of downtime. Fine for demo data that resets nightly.
- Watch: community reports of delayed SSE events on iOS Safari through Fly's HTTP/2 proxy; test on a phone after the first deploy.
- Watch: running as root in the container; acceptable for a single-purpose demo machine.

## Alternatives considered

- **Railway Hobby:** simplest UI, $5/month cap; long requests need data flowing.
- **Render:** no disk on the free tier; $7/month minimum.
- **VPS (Hetzner):** cheapest at scale, but we would own HTTPS, updates and restarts.
