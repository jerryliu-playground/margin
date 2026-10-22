import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:4173';
const SERVER_URL = 'http://127.0.0.1:8787';

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
        PORT: '8787',
      },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @margin/web build && pnpm --filter @margin/web preview',
      url: WEB_URL,
      env: { VITE_AGENT_URL: SERVER_URL },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
