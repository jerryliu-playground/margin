import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTokenService } from '@margin/agent-token';
import { loadConfig } from './config';
import { testRequest } from './testing/test-request';
import { testApp } from './testing/test-app';

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

  it('allows CMS origins for /agent only', async () => {
    const app = await testApp({ CMS_ORIGINS: 'http://localhost:1337, http://cms.test' });
    const preflight = (url: string) =>
      app.inject({
        method: 'OPTIONS',
        url,
        headers: {
          origin: 'http://localhost:1337',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type',
        },
      });
    expect((await preflight('/agent')).headers['access-control-allow-origin']).toBe(
      'http://localhost:1337',
    );
    expect((await preflight('/documents')).headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('lets a CMS token run the agent but not read documents', async () => {
    const secret = 's'.repeat(32);
    const app = await testApp({ MARGIN_TOKEN_SECRET: secret });
    const { token } = createTokenService(secret).issue({ iss: 'strapi', sub: '1' });
    const headers = { authorization: `Bearer ${token}` };
    const docs = await app.inject({ method: 'GET', url: '/documents', headers });
    expect(docs.statusCode).toBe(403);
    expect(docs.json()).toMatchObject({ error: { code: 'forbidden' } });
    const agent = await app.inject({
      method: 'POST',
      url: '/agent',
      headers: { ...headers, accept: 'text/event-stream' },
      payload: testRequest([{ id: 'u1', role: 'user', content: 'Hello' }]),
    });
    expect(agent.statusCode).toBe(200);
    await app.close();
  });

  it('rejects a malformed CMS_ORIGINS', () => {
    expect(() => loadConfig({ CMS_ORIGINS: 'not a url' })).toThrow(/CMS_ORIGINS/);
  });

  it('rate-limits with a 429 in the API error shape', async () => {
    const app = await testApp({ RATE_LIMIT_PER_MINUTE: '2' });
    for (let i = 0; i < 2; i++) await app.inject({ method: 'GET', url: '/health' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ error: { code: 'rate_limited' } });
    await app.close();
  });

  it('serves the built web app from the same origin when MARGIN_WEB_DIST is set', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'margin-dist-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Margin</title>');
    const app = await testApp({ MARGIN_WEB_DIST: dist });
    const page = await app.inject({ method: 'GET', url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain('<title>Margin</title>');
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.json()).toEqual({ status: 'ok' });
    await app.close();
    rmSync(dist, { recursive: true, force: true });
  });

  it('uses X-Forwarded-For for the client IP only when TRUST_PROXY is on', async () => {
    const trusted = await testApp({ TRUST_PROXY: 'true', RATE_LIMIT_PER_MINUTE: '1' });
    const a = await trusted.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-forwarded-for': '1.1.1.1' },
    });
    const b = await trusted.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-forwarded-for': '2.2.2.2' },
    });
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]); // two clients, one request each
    await trusted.close();

    // Without TRUST_PROXY the header is ignored: both requests come from the same IP.
    const direct = await testApp({ RATE_LIMIT_PER_MINUTE: '1' });
    const c = await direct.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-forwarded-for': '1.1.1.1' },
    });
    const d = await direct.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-forwarded-for': '2.2.2.2' },
    });
    expect([c.statusCode, d.statusCode]).toEqual([200, 429]);
    await direct.close();
  });

  it('refuses the anthropic model without a key', () => {
    expect(() => loadConfig({ MARGIN_MODEL: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('refuses production without a token secret', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/MARGIN_TOKEN_SECRET/);
  });
});
