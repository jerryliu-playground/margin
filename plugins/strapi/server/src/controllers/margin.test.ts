import { createTokenService } from '@margin/agent-token';
import { describe, expect, it } from 'vitest';
import { createMarginHandlers, type MarginContext } from './margin';

const config = {
  agentUrl: 'http://localhost:8790',
  tokenSecret: 's'.repeat(32),
  contentTypes: { 'api::article.article': { body: 'body' } },
};

function context(user?: { id: number }): MarginContext & { denied?: string } {
  const ctx: MarginContext & { denied?: string } = {
    state: user ? { user } : {},
    unauthorized(message) {
      ctx.denied = message;
    },
  };
  return ctx;
}

describe('Margin plugin routes', () => {
  it('signs a token the Margin server accepts, naming the admin', () => {
    const ctx = context({ id: 7 });
    createMarginHandlers(config, () => 1_000).token(ctx);
    const { token } = ctx.body as { token: string };
    expect(createTokenService(config.tokenSecret, () => 2_000).verify(token)).toMatchObject({
      iss: 'strapi',
      sub: '7',
    });
  });

  it('refuses without a signed-in admin', () => {
    const ctx = context();
    createMarginHandlers(config).token(ctx);
    expect(ctx.body).toBeUndefined();
    expect(ctx.denied).toMatch(/Sign in/);
  });

  it('returns the settings without the secret', () => {
    const ctx = context({ id: 1 });
    createMarginHandlers(config).settings(ctx);
    expect(ctx.body).toEqual({ agentUrl: config.agentUrl, contentTypes: config.contentTypes });
  });
});
