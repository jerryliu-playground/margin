import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config';

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: config.NODE_ENV === 'production' ? 'warn' : 'info',
            // CLAUDE.md rule 3: never log tokens or user content.
            redact: ['req.headers.authorization', 'req.body'],
          },
  });

  await app.register(cors, { origin: [config.WEB_ORIGIN] });

  app.get('/health', async () => ({ status: 'ok' as const }));

  return app;
}
