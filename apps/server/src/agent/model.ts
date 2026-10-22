import { createAnthropic } from '@ai-sdk/anthropic';
import type { AgentRunRequest } from '@margin/shared';
import type { LanguageModel } from 'ai';
import type { Config } from '../config';
import { createMockModel } from './mock-model';

/** The only place that reads the model key (CLAUDE.md rule 3). */
export function createModelFactory(config: Config): (request: AgentRunRequest) => LanguageModel {
  if (config.MARGIN_MODEL === 'mock') return createMockModel;
  const anthropic = createAnthropic({ apiKey: config.ANTHROPIC_API_KEY });
  const model = anthropic(config.MARGIN_ANTHROPIC_MODEL);
  return () => model;
}
