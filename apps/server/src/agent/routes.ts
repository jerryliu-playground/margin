import { agentRunRequestSchema, frontendTools } from '@margin/shared';
import type { AgentRunRequest } from '@margin/shared';
import type { LanguageModel } from 'ai';
import type { FastifyInstance } from 'fastify';
import { HttpError, parseOr400 } from '../errors';
import { runAgent } from './run';

interface AgentRouteOptions {
  createModel: (request: AgentRunRequest) => LanguageModel;
  maxOutputTokens: number;
  ratePerMinute: number;
  dailyRuns: { take(): boolean };
}

export function agentRoutes({
  createModel,
  maxOutputTokens,
  ratePerMinute,
  dailyRuns,
}: AgentRouteOptions) {
  return async (app: FastifyInstance) => {
    app.post(
      '/agent',
      { sse: 'manual', config: { rateLimit: { max: ratePerMinute, timeWindow: '1 minute' } } },
      async (req, reply) => {
        // Validate before the stream opens, so a bad request is a plain 400.
        const request = parseOr400(agentRunRequestSchema, req.body);
        const unknown = request.tools.find((t) => !(t.name in frontendTools));
        if (unknown) throw new HttpError(400, 'invalid_request', `Unknown tool "${unknown.name}".`);
        if (!dailyRuns.take()) {
          throw new HttpError(
            429,
            'daily_limit',
            "The demo has used today's agent runs. Try again tomorrow.",
          );
        }

        const abort = new AbortController();
        reply.sse.onClose(() => abort.abort());
        const events = runAgent({
          request,
          model: createModel(request),
          maxOutputTokens,
          signal: abort.signal,
          // Log the failure, never the prompt or document (CLAUDE.md rule 3).
          onUsage: (usage) => req.log.info({ usage }, 'agent run usage'),
          onError: (error) =>
            req.log.error(
              { err: { message: (error as Error)?.message ?? String(error) } },
              'agent run failed',
            ),
        });

        // @fastify/sse writes each event as `data: <json>\n\n`, the AG-UI SSE framing.
        async function* sse() {
          for await (const event of events) yield { data: event };
        }
        await reply.sse.send(sse());
      },
    );
  };
}
