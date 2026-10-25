import { createTokenService } from '@margin/agent-token';
import type { AuthTokenResponse, CmsPanelSettings } from '@margin/shared';
import type { Core } from '@strapi/strapi';
import type { MarginConfig } from '../config';

/** The parts of a Koa context the handlers use, so tests need no Strapi. */
export interface MarginContext {
  state: { user?: { id: number | string } };
  body?: unknown;
  unauthorized(message: string): void;
}

/** Route handlers on a validated config (ADR 0010). */
export function createMarginHandlers(config: MarginConfig, now?: () => number) {
  const tokens = createTokenService(config.tokenSecret, now);
  return {
    settings(ctx: MarginContext) {
      const settings: CmsPanelSettings = {
        agentUrl: config.agentUrl,
        ...(config.contentTypes ? { contentTypes: config.contentTypes } : {}),
      };
      ctx.body = settings;
    },
    token(ctx: MarginContext) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized('Sign in to the Strapi admin first.');
      const body: AuthTokenResponse = tokens.issue({ iss: 'strapi', sub: String(user.id) });
      ctx.body = body;
    },
  };
}

export type MarginHandlers = ReturnType<typeof createMarginHandlers>;

const controller = ({ strapi }: { strapi: Core.Strapi }): MarginHandlers =>
  createMarginHandlers({
    agentUrl: strapi.plugin('margin').config('agentUrl'),
    tokenSecret: strapi.plugin('margin').config('tokenSecret'),
    contentTypes: strapi.plugin('margin').config('contentTypes'),
  });

export default controller;
