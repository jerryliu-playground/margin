# Phase 3 plan

Approved by the owner on 2026-10-22. One concern per commit; each commit passes `pnpm check` on its own (CLAUDE.md rule 8).

**Goal (SPEC §7):** deployed demo, 2–3 minute video, README with the harness write-up; plus the Phase 3 features (10 batch review, 11 tone presets, 12 deployed demo with seed and rate limiting).

**Resuming:** compare the steps with `git log --oneline`. Each step's commit subject starts with its tag (e.g. `P3.4`). Start at the first unticked step and tick it in the same commit.

## Decisions

1. **Hosting: Fly.io, always on.** shared-cpu-1x 512 MB + 1 GB volume, about $3.85/month; `min_machines_running = 1`, so interview demos have no cold start. The volume lives on one machine with daily snapshots only, which is fine for demo data.
2. **One process, one origin.** The server serves the built web app and the API; no CORS in production.
3. **Public-demo protection:** `trustProxy` (per-IP limits work behind Fly's proxy), a global daily cap on agent runs (default 300), a cap on the number of documents, and a nightly reset of the database to the seeded article. Plus the owner's spend limit in the Anthropic Console.
4. **Features 10 and 11 are in scope.**

## Steps

PR A (`phase-3` branch):

- [x] **P3.1 Image cards show a thumbnail and the alt text change** — no raw `![alt](src)` diff. The thumbnail uses the block's current `src` from the host, never a URL from the agent. `packages/agent-panel`.
- [x] **P3.2 No duplicate issue list** — the check result already lists the issues; the agent says what it will fix instead of listing them again. Prompt + mock model. `apps/server`.
- [x] **P3.3 Production build** — the server serves `apps/web/dist` (same origin); multi-stage `Dockerfile`; CI builds the image. `apps/server`, `Dockerfile`, `.github/workflows/ci.yml`.
- [x] **P3.4 Public-demo protection** — `trustProxy`, daily agent-run cap with a plain message, document cap, nightly reset to the seed. `apps/server`.
- [x] **P3.5 Tone presets (feature 11)** — "More formal", "Shorter", "Friendlier" buttons in the panel; mock-model scripts. `packages/agent-panel`, `apps/server`.
- [x] **P3.6 Batch review (feature 10)** — "Accept all" / "Reject all" when a turn has several pending proposals; focus handled. `packages/agent-panel`.
- [x] **P3.7 Deploy config** — `fly.toml`, volume, health check, deploy workflow on `main`; ADR 0009 (hosting). Root, `.github/workflows/`, `docs/adr/`.

After PR A is merged:

- [x] **P3.8 Go live** — the owner creates the Fly app, sets `ANTHROPIC_API_KEY` and `MARGIN_TOKEN_SECRET` with `fly secrets set`, adds `FLY_API_TOKEN` to GitHub; first deploy; real-model smoke test, including on a phone (SSE on iOS Safari). Done 2026-10-22: live at https://margin-demo.fly.dev; real-model check and accept flow pass; the phone-width layout was broken (fixed on the next branch); iOS Safari still to test on a real device.

PR B:

- [x] **P3.9 README** — what it is, architecture, how AG-UI is used, the harness (guides, sensors, steering loop with harness-log evidence), running locally, ADR index, live link.
- [x] **P3.10 Demo script** — 2–3 minute shot list and narration for the owner to record. `docs/demo-script.md`.

## Owner-only actions

Fly.io account and payment method; `fly secrets set` with the real key; `FLY_API_TOKEN` repository secret; recording the video.

## Risks to watch

- SSE on iOS Safari through Fly's HTTP/2 proxy (community reports of delayed events): test on a phone after P3.8.
- Single machine + volume: a few seconds of downtime on each deploy.
