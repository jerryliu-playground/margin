import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { testApp } from './test-helpers';

describe('server', () => {
  it('answers /health', async () => {
    const app = await testApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('allows CORS only from the web origin', async () => {
    const app = await testApp({ WEB_ORIGIN: 'http://localhost:5173' });
    const ok = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:5173' },
    });
    const other = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://evil.test' },
    });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('rate-limits with a 429 in the API error shape', async () => {
    const app = await testApp({ RATE_LIMIT_PER_MINUTE: '2' });
    for (let i = 0; i < 2; i++) await app.inject({ method: 'GET', url: '/health' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ error: { code: 'rate_limited' } });
    await app.close();
  });

  it('refuses the anthropic model without a key', () => {
    expect(() => loadConfig({ MARGIN_MODEL: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('refuses production without a token secret', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/MARGIN_TOKEN_SECRET/);
  });
});
