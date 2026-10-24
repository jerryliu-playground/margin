import path from 'path';
import type { Core } from '@strapi/strapi';

// SQLite only: this project exists to develop and test the Margin plugin.
const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Database => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.join(__dirname, '..', '..', env('DATABASE_FILENAME', '.tmp/data.db')),
    },
    useNullAsDefault: true,
  },
});

export default config;
