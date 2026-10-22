import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  /** "mock" = deterministic mock model (tests, offline dev). "anthropic" = Claude. */
  MARGIN_MODEL: z.enum(['mock', 'anthropic']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${z.prettifyError(parsed.error)}`);
  }
  if (parsed.data.MARGIN_MODEL === 'anthropic' && !parsed.data.ANTHROPIC_API_KEY) {
    throw new Error(
      'MARGIN_MODEL=anthropic needs ANTHROPIC_API_KEY in the server environment. Use MARGIN_MODEL=mock for tests and offline dev.',
    );
  }
  return parsed.data;
}
