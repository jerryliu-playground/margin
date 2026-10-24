import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests of the Strapi plugin (ADR 0010): a fresh example Strapi project and the
 * Margin server with the mock model (CLAUDE.md rule 5). Not part of `pnpm check`: Strapi's
 * admin build is slow, so this runs as `pnpm e2e:strapi` and as its own CI job.
 * Every value below is a local test value, used nowhere else.
 */
const STRAPI_PORT = 11337;
const SERVER_PORT = 18797;
export const STRAPI_URL = `http://localhost:${STRAPI_PORT}`;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const TOKEN_SECRET = 'e2e-only-token-secret-at-least-32-characters';
export const ADMIN = { email: 'e2e@margin.test', password: 'E2e-only-Margin-1' };
/** The signed-in admin, saved once by e2e-strapi/auth.setup.ts. */
export const ADMIN_STATE = 'test-results/.strapi-admin.json';

export default defineConfig({
  testDir: 'e2e-strapi',
  forbidOnly: !!process.env.CI,
  // One worker: Strapi rate-limits admin logins, and every test shares one database.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: STRAPI_URL, trace: 'retain-on-failure', viewport: { width: 1440, height: 900 } },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: ADMIN_STATE,
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @margin/server start',
      url: `${SERVER_URL}/health`,
      env: {
        MARGIN_MODEL: 'mock',
        NODE_ENV: 'test',
        MARGIN_DB_PATH: ':memory:',
        PORT: String(SERVER_PORT),
        CMS_ORIGINS: STRAPI_URL,
        MARGIN_TOKEN_SECRET: TOKEN_SECRET,
        RATE_LIMIT_PER_MINUTE: '100000',
        AGENT_RATE_LIMIT_PER_MINUTE: '100000',
        DAILY_AGENT_RUN_LIMIT: '100000',
      },
      reuseExistingServer: false,
    },
    {
      // A fresh database each run; the plugin and the admin are built from source.
      command:
        "node -e \"require('fs').rmSync('examples/strapi/.tmp/e2e.db',{force:true})\" && " +
        'pnpm --filter @margin/strapi-plugin build && ' +
        'pnpm --filter @margin/example-strapi build && ' +
        'pnpm --filter @margin/example-strapi start',
      url: `${STRAPI_URL}/_health`,
      timeout: 300_000,
      env: {
        HOST: '127.0.0.1',
        PORT: String(STRAPI_PORT),
        DATABASE_FILENAME: '.tmp/e2e.db',
        APP_KEYS: 'e2e-only-key-1,e2e-only-key-2',
        API_TOKEN_SALT: 'e2e-only-salt',
        ADMIN_JWT_SECRET: 'e2e-only-admin-jwt-secret',
        TRANSFER_TOKEN_SALT: 'e2e-only-transfer-salt',
        JWT_SECRET: 'e2e-only-jwt-secret',
        ENCRYPTION_KEY: 'e2e-only-encryption-key',
        MARGIN_AGENT_URL: SERVER_URL,
        MARGIN_TOKEN_SECRET: TOKEN_SECRET,
        MARGIN_EXAMPLE_ADMIN_EMAIL: ADMIN.email,
        MARGIN_EXAMPLE_ADMIN_PASSWORD: ADMIN.password,
      },
      reuseExistingServer: false,
    },
  ],
});
