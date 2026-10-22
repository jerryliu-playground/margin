import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { loadConfig } from './config';

describe('server', () => {
  it('answers /health', async () => {
    const app = await buildApp(loadConfig({ NODE_ENV: 'test' }));
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('allows CORS only from the web origin', async () => {
    const app = await buildApp(
      loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:5173' }),
    );
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

  it('refuses the anthropic model without a key', () => {
    expect(() => loadConfig({ MARGIN_MODEL: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });
});
