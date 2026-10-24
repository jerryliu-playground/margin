import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => {
  const keys = env.array('APP_KEYS');
  if (!keys?.length)
    throw new Error('APP_KEYS is not set. Run scripts/ensure-env.mjs to create .env.');
  return {
    host: env('HOST', '127.0.0.1'),
    port: env.int('PORT', 1337),
    app: { keys },
  };
};

export default config;
