import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TOKEN_TTL_MS, createTokenService } from './index';

const SECRET = 'a'.repeat(32);
const DEMO = { iss: 'demo', sub: '' };

describe('token service', () => {
  it('verifies its own token and returns who asked', () => {
    const tokens = createTokenService(SECRET, () => 1_000);
    const { token } = tokens.issue({ iss: 'strapi', sub: '7' });
    expect(tokens.verify(token)).toEqual({ iss: 'strapi', sub: '7', exp: 1_000 + TOKEN_TTL_MS });
  });

  it('rejects an expired token', () => {
    let now = 1_000;
    const tokens = createTokenService(SECRET, () => now);
    const { token } = tokens.issue(DEMO);
    now += TOKEN_TTL_MS + 1;
    expect(tokens.verify(token)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const other = createTokenService('b'.repeat(32)).issue(DEMO).token;
    expect(createTokenService(SECRET).verify(other)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const tokens = createTokenService(SECRET);
    const [, sig] = tokens.issue(DEMO).token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...DEMO, sub: 'admin', exp: Date.now() + 10 ** 9 }),
    ).toString('base64url');
    expect(tokens.verify(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects a correctly signed payload without iss and sub', () => {
    // The format before ADR 0010: signed, but only an expiry.
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 10 ** 9 })).toString(
      'base64url',
    );
    const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
    expect(createTokenService(SECRET).verify(`${payload}.${sig}`)).toBeNull();
  });

  it('rejects garbage', () => {
    const tokens = createTokenService(SECRET);
    for (const t of ['', 'abc', 'a.b.c', '.']) expect(tokens.verify(t)).toBeNull();
  });
});
