import { defineConfig, devices } from '@playwright/test';

// Dedicated ports so e2e never reuses a dev server (or another project's server) by accident.
const WEB_PORT = 14173;
const SERVER_PORT = 18787;
const WEB_URL = `http://localhost:${WEB_PORT}`;
export const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: WEB_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // CLAUDE.md rule 5: e2e always runs the server with the mock model.
      command: 'pnpm --filter @margin/server start',
      url: `${SERVER_URL}/health`,
      env: {
        MARGIN_MODEL: 'mock',
        NODE_ENV: 'test',
        MARGIN_DB_PATH: ':memory:',
        WEB_ORIGIN: WEB_URL,
        PORT: String(SERVER_PORT),
        // The suite makes many agent runs per minute; rate limits have their own unit tests.
        RATE_LIMIT_PER_MINUTE: '100000',
        AGENT_RATE_LIMIT_PER_MINUTE: '100000',
      },
      reuseExistingServer: false,
    },
    {
      command: `pnpm --filter @margin/web build && pnpm --filter @margin/web preview --port ${WEB_PORT}`,
      url: WEB_URL,
      env: { VITE_AGENT_URL: SERVER_URL },
      reuseExistingServer: false,
    },
  ],
});
