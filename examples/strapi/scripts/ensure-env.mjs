// Writes examples/strapi/.env with fresh random secrets on first run (like create-strapi).
// The file is git-ignored; nothing in it is shared with any other deployment.
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../.env', import.meta.url));
if (!existsSync(file)) {
  const secret = () => randomBytes(16).toString('base64');
  writeFileSync(
    file,
    [
      'HOST=127.0.0.1',
      'PORT=1337',
      `APP_KEYS=${[secret(), secret()].join(',')}`,
      `API_TOKEN_SALT=${secret()}`,
      `ADMIN_JWT_SECRET=${secret()}`,
      `TRANSFER_TOKEN_SALT=${secret()}`,
      `JWT_SECRET=${secret()}`,
      `ENCRYPTION_KEY=${secret()}`,
      '',
    ].join('\n'),
  );
  console.log('Wrote examples/strapi/.env with new local secrets.');
}
