import { authTokenResponseSchema } from '@margin/shared';

/**
 * Agent tokens from the plugin's POST /margin/token, reused until a minute before they
 * expire (15 minutes, ADR 0006).
 */
export function createTokenSource(request: () => Promise<unknown>, now: () => number = Date.now) {
  let cached: { token: string; expiresAt: number } | undefined;
  return async (): Promise<string> => {
    if (cached && cached.expiresAt - now() > 60_000) return cached.token;
    const body = authTokenResponseSchema.parse(await request());
    cached = { token: body.token, expiresAt: Date.parse(body.expiresAt) };
    return body.token;
  };
}
