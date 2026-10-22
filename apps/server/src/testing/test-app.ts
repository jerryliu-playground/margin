import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { loadConfig } from '../config';

/** An app on an in-memory database with the mock model. */
export async function testApp(env: NodeJS.ProcessEnv = {}): Promise<FastifyInstance> {
  return buildApp(loadConfig({ NODE_ENV: 'test', MARGIN_DB_PATH: ':memory:', ...env }));
}

export async function bearer(app: FastifyInstance): Promise<{ authorization: string }> {
  const res = await app.inject({ method: 'POST', url: '/auth/token' });
  return { authorization: `Bearer ${res.json<{ token: string }>().token}` };
}
