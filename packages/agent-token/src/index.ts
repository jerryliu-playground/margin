import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_TTL_MS = 15 * 60 * 1000;

/** Who asked for the token: `iss` is the host ("demo", "strapi"), `sub` its user id, if any. */
export interface TokenSubject {
  iss: string;
  sub: string;
}
export interface TokenClaims extends TokenSubject {
  /** Expiry, in milliseconds since the epoch. */
  exp: number;
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

function isClaims(value: unknown): value is TokenClaims {
  if (typeof value !== 'object' || value === null) return false;
  const { exp, iss, sub } = value as Record<string, unknown>;
  return typeof exp === 'number' && typeof iss === 'string' && typeof sub === 'string';
}

/**
 * Short-lived bearer tokens for the agent server (ADR 0006, ADR 0010).
 * Format: base64url(JSON claims).base64url(HMAC-SHA256). Node only: every host mints
 * tokens on its server (the demo's API, the Strapi plugin's route), never in the browser.
 */
export function createTokenService(secret: string, now: () => number = Date.now) {
  const sign = (payload: string) => b64(createHmac('sha256', secret).update(payload).digest());

  return {
    issue(subject: TokenSubject): { token: string; expiresAt: string } {
      const claims: TokenClaims = { ...subject, exp: now() + TOKEN_TTL_MS };
      const payload = b64(JSON.stringify(claims));
      return {
        token: `${payload}.${sign(payload)}`,
        expiresAt: new Date(claims.exp).toISOString(),
      };
    },

    /** The token's claims, or null if it is forged, malformed or expired. */
    verify(token: string): TokenClaims | null {
      const [payload, signature, extra] = token.split('.');
      if (!payload || !signature || extra !== undefined) return null;
      const expected = Buffer.from(sign(payload));
      const given = Buffer.from(signature);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
      try {
        const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return isClaims(claims) && claims.exp > now() ? claims : null;
      } catch {
        return null;
      }
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;

/** Dev and test get a per-process random secret; production must set MARGIN_TOKEN_SECRET. */
export function randomSecret(): string {
  return randomBytes(32).toString('hex');
}
