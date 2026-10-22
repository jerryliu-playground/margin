# Deploying the demo

The demo runs on Fly.io as one always-on machine with a volume for SQLite (ADR 0009). After the one-time setup, every push to `main` deploys automatically once CI passes.

## One-time setup (owner)

1. Install `flyctl` and sign in: `fly auth login`.
2. Pick an app name you own and put it in `fly.toml` (`app`, and the host in `WEB_ORIGIN`). Commit that change.
3. Create the app and its volume (same region as `primary_region`):

   ```bash
   fly apps create <app-name>
   fly volumes create margin_data --region iad --size 1 --app <app-name>
   ```

4. Set the secrets. Type the values yourself; never paste them into a file or a chat:

   ```bash
   fly secrets set ANTHROPIC_API_KEY=... --app <app-name>
   fly secrets set MARGIN_TOKEN_SECRET="$(openssl rand -hex 32)" --app <app-name>
   ```

5. First deploy from your machine: `fly deploy`.
6. For automatic deploys, create a deploy token and add it to GitHub as the `FLY_API_TOKEN` repository secret:

   ```bash
   fly tokens create deploy -x 999999h --app <app-name>
   ```

## After each deploy

- `fly status` and `fly logs` show the machine and the server log (`agent model: anthropic/...`).
- The health check is `GET /health`.

## Cost and limits

- shared-cpu-1x, 512 MB, always on, plus a 1 GB volume: about $3.85/month (Fly pricing, 2026-10-22).
- Model spend is capped by `DAILY_AGENT_RUN_LIMIT` (300 runs/day) and by the spend limit you set in the Anthropic Console.
- The database resets to the seeded article every day at `DEMO_RESET_HOUR_UTC` (10:00 UTC).
