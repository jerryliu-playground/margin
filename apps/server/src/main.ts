import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = await buildApp(config);
await app.listen({ port: config.PORT, host: config.HOST });
// Which model runs, never the key (CLAUDE.md rule 3).
app.log.warn(
  config.MARGIN_MODEL === 'anthropic'
    ? `agent model: anthropic/${config.MARGIN_ANTHROPIC_MODEL}, max ${config.MARGIN_MAX_OUTPUT_TOKENS} output tokens`
    : 'agent model: mock (no API calls)',
);
