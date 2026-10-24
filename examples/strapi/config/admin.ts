import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Admin => {
  const required = (name: string): string => {
    const value = env(name);
    if (!value) throw new Error(`${name} is not set. Run scripts/ensure-env.mjs to create .env.`);
    return value;
  };
  return {
    auth: { secret: required('ADMIN_JWT_SECRET') },
    apiToken: { salt: required('API_TOKEN_SALT') },
    transfer: { token: { salt: required('TRANSFER_TOKEN_SALT') } },
    secrets: { encryptionKey: required('ENCRYPTION_KEY') },
    // A development project: no surveys or upsell banners in the admin.
    flags: { nps: false, promoteEE: false },
  };
};

export default config;
