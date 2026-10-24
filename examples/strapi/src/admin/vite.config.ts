import { mergeConfig, type UserConfig } from 'vite';

/**
 * The Margin plugin is a workspace package with its own node_modules. Resolve React and
 * Strapi from this project only (dedupe needs direct dependencies of this project), so the admin bundle never holds two
 * copies ("must be used within StrapiApp"; ADR 0010).
 */
export default (config: UserConfig) =>
  mergeConfig(config, {
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router-dom', 'styled-components', '@strapi/strapi'],
    },
  });
