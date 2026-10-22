import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8790),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  /** "mock" = deterministic mock model (tests, offline dev). "anthropic" = Claude. */
  MARGIN_MODEL: z.enum(['mock', 'anthropic']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Claude model id used when MARGIN_MODEL=anthropic. */
  MARGIN_ANTHROPIC_MODEL: z.string().min(1).default('claude-haiku-5-5'),
  /** Output cap per agent run (SPEC §6). Includes thinking tokens. */
  MARGIN_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(64_000).default(16_000),
  /** Interface to listen on. 0.0.0.0 inside a container. */
  HOST: z.string().min(1).default('127.0.0.1'),
  /** Built web app (apps/web/dist) to serve from this process, for one-origin production. */
  MARGIN_WEB_DIST: z.string().min(1).optional(),
  /** SQLite file path, or ":memory:". */
  MARGIN_DB_PATH: z.string().min(1).default('./data/margin.db'),
  /** HMAC secret for short-lived tokens. Required in production. */
  MARGIN_TOKEN_SECRET: z.string().min(32).optional(),
  /** Requests per minute per IP, for all routes. /agent has its own lower limit. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  AGENT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  /** Agent runs per UTC day for the whole server (public demo cost cap). */
  DAILY_AGENT_RUN_LIMIT: z.coerce.number().int().positive().default(300),
  /** Most documents the server keeps; creating more is refused. */
  MAX_DOCUMENTS: z.coerce.number().int().positive().default(200),
  /** If set (0–23), the database resets to the seeded article once a day at this UTC hour. */
  DEMO_RESET_HOUR_UTC: z.coerce.number().int().min(0).max(23).optional(),
  /** Behind a proxy (Fly.io), read the client IP from X-Forwarded-For so per-IP limits work. */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${z.prettifyError(parsed.error)}`);
  }
  const config = parsed.data;
  if (config.MARGIN_MODEL === 'anthropic' && !config.ANTHROPIC_API_KEY) {
    throw new Error(
      'MARGIN_MODEL=anthropic needs ANTHROPIC_API_KEY in the server environment. Use MARGIN_MODEL=mock for tests and offline dev.',
    );
  }
  if (config.NODE_ENV === 'production' && !config.MARGIN_TOKEN_SECRET) {
    throw new Error(
      'NODE_ENV=production needs MARGIN_TOKEN_SECRET (at least 32 characters), so tokens survive restarts and cannot be forged.',
    );
  }
  return config;
}
