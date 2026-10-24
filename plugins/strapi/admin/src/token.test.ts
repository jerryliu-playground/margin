import { describe, expect, it, vi } from 'vitest';
import { createTokenSource } from './token';

describe('createTokenSource', () => {
  it('reuses a token until a minute before it expires', async () => {
    let now = 0;
    const request = vi.fn(async () => ({
      token: `t${request.mock.calls.length}`,
      expiresAt: new Date(now + 15 * 60_000).toISOString(),
    }));
    const get = createTokenSource(request, () => now);
    expect(await get()).toBe('t1');
    now = 13 * 60_000;
    expect(await get()).toBe('t1');
    now = 14 * 60_000 + 1;
    expect(await get()).toBe('t2');
  });

  it('rejects a malformed response', async () => {
    await expect(createTokenSource(async () => ({ nope: true }))()).rejects.toThrow();
  });
});
