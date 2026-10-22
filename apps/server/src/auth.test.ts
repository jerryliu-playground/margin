import { describe, expect, it } from 'vitest';
import { TOKEN_TTL_MS, createTokenService } from './auth';

const SECRET = 'a'.repeat(32);

describe('token service', () => {
  it('verifies its own token', () => {
    const tokens = createTokenService(SECRET);
    expect(tokens.verify(tokens.issue().token)).toBe(true);
  });

  it('rejects an expired token', () => {
    let now = 1_000;
    const tokens = createTokenService(SECRET, () => now);
    const { token } = tokens.issue();
    now += TOKEN_TTL_MS + 1;
    expect(tokens.verify(token)).toBe(false);
  });

  it('rejects a token signed with another secret', () => {
    const other = createTokenService('b'.repeat(32)).issue().token;
    expect(createTokenService(SECRET).verify(other)).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const tokens = createTokenService(SECRET);
    const [, sig] = tokens.issue().token.split('.');
    const forged = Buffer.from(JSON.stringify({ exp: Date.now() + 10 ** 9 })).toString('base64url');
    expect(tokens.verify(`${forged}.${sig}`)).toBe(false);
  });

  it('rejects garbage', () => {
    const tokens = createTokenService(SECRET);
    for (const t of ['', 'abc', 'a.b.c', '.']) expect(tokens.verify(t)).toBe(false);
  });
});
