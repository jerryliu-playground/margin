import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_TTL_MS = 15 * 60 * 1000;

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

/**
 * Short-lived bearer tokens for the demo (ADR 0006, Phase 1 decision 4).
 * Format: base64url({"exp":<ms>}).base64url(HMAC-SHA256). No user identity: the
 * demo has no login. CMS hosts will mint their own tokens from their backend.
 */
export function createTokenService(secret: string, now: () => number = Date.now) {
  const sign = (payload: string) => b64(createHmac('sha256', secret).update(payload).digest());

  return {
    issue(): { token: string; expiresAt: string } {
      const exp = now() + TOKEN_TTL_MS;
      const payload = b64(JSON.stringify({ exp }));
      return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
    },

    verify(token: string): boolean {
      const [payload, signature, extra] = token.split('.');
      if (!payload || !signature || extra !== undefined) return false;
      const expected = Buffer.from(sign(payload));
      const given = Buffer.from(signature);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
      try {
        const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
          exp?: unknown;
        };
        return typeof exp === 'number' && exp > now();
      } catch {
        return false;
      }
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;

/** Dev and test get a per-process random secret; production must set MARGIN_TOKEN_SECRET. */
export function randomSecret(): string {
  return randomBytes(32).toString('hex');
}
