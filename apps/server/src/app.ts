import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sse from '@fastify/sse';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { createModelFactory } from './agent/model';
import { agentRoutes } from './agent/routes';
import { createTokenService, randomSecret } from './auth';
import type { Config } from './config';
import { openDb } from './db/client';
import { createDocumentRepository } from './documents/repository';
import { documentRoutes } from './documents/routes';
import { seedIfEmpty } from './documents/seed';
import { HttpError, apiError } from './errors';

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 512 * 1024,
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: config.NODE_ENV === 'production' ? 'warn' : 'info',
            // CLAUDE.md rule 3: never log tokens or user content.
            redact: ['req.headers.authorization', 'req.body'],
          },
  });

  const db = openDb(config.MARGIN_DB_PATH);
  app.addHook('onClose', async () => db.close());
  const repo = createDocumentRepository(db);
  seedIfEmpty(repo);
  const tokens = createTokenService(config.MARGIN_TOKEN_SECRET ?? randomSecret());

  await app.register(cors, {
    origin: [config.WEB_ORIGIN],
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['authorization', 'content-type'],
  });
  await app.register(rateLimit, { max: config.RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' });
  await app.register(sse, { heartbeatInterval: 15_000 });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send(apiError(err.code, err.message));
    }
    const {
      statusCode,
      message: rawMessage,
      stack,
    } = (err ?? {}) as {
      statusCode?: unknown;
      message?: string;
      stack?: string;
    };
    const status = typeof statusCode === 'number' ? statusCode : 500;
    if (status >= 500) app.log.error({ err: { message: rawMessage, stack } });
    const message = status >= 500 ? 'Something went wrong on the server.' : (rawMessage ?? 'Error');
    return reply.code(status).send(apiError(status === 429 ? 'rate_limited' : 'error', message));
  });

  app.get('/health', async () => ({ status: 'ok' as const }));

  // Production: the web app is served from the same origin as the API (ADR 0009).
  // API routes are more specific than the static wildcard, so they keep winning.
  if (config.MARGIN_WEB_DIST) {
    await app.register(fastifyStatic, { root: resolve(config.MARGIN_WEB_DIST), maxAge: '1h' });
  }
  app.post(
    '/auth/token',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async () => tokens.issue(),
  );

  // Everything registered inside needs a valid bearer token.
  await app.register(async (secured) => {
    secured.addHook('onRequest', async (req) => {
      const header = req.headers.authorization ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!token || !tokens.verify(token)) {
        throw new HttpError(
          401,
          'unauthorized',
          'Missing or expired token. Get one from POST /auth/token.',
        );
      }
    });
    await secured.register(documentRoutes(repo));
    await secured.register(
      agentRoutes({
        createModel: createModelFactory(config),
        maxOutputTokens: config.MARGIN_MAX_OUTPUT_TOKENS,
        ratePerMinute: config.AGENT_RATE_LIMIT_PER_MINUTE,
      }),
    );
  });

  return app;
}
