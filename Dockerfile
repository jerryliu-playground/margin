# Margin demo image: one Node process serves the web app and the API (ADR 0009).

FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
# Manifests first, so the dependency layer is cached between source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/agent-token/package.json packages/agent-token/
COPY packages/agent-panel/package.json packages/agent-panel/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @margin/web build

FROM node:24-slim
# The server runs TypeScript through tsx and imports the shared package as source,
# so the runtime image keeps the workspace as built (no separate compile step).
COPY --from=build /app /app
WORKDIR /app/apps/server
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    MARGIN_MODEL=anthropic \
    MARGIN_DB_PATH=/data/margin.db \
    MARGIN_WEB_DIST=/app/apps/web/dist \
    WEB_ORIGIN=http://localhost:8080
EXPOSE 8080
# Runs as root: the Fly volume mounted at /data is owned by root (see ADR 0009).
# tsx directly, not through pnpm, so nothing is downloaded at start.
CMD ["node_modules/.bin/tsx", "src/main.ts"]
