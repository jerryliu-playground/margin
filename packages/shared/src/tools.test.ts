import { describe, expect, it } from 'vitest';
import {
  frontendToolDefinitions,
  proposalResultSchema,
  proposeBodyEditArgsSchema,
  proposeFieldValueArgsSchema,
} from './tools';

describe('frontend tool schemas', () => {
  it('accepts a string or a tag list as a field value', () => {
    expect(
      proposeFieldValueArgsSchema.safeParse({ field: 'title', value: 'Hi', reason: 'Shorter.' })
        .success,
    ).toBe(true);
    expect(
      proposeFieldValueArgsSchema.safeParse({ field: 'tags', value: ['a', 'b'], reason: 'Topics.' })
        .success,
    ).toBe(true);
  });

  it('rejects a proposal without a reason', () => {
    expect(proposeFieldValueArgsSchema.safeParse({ field: 'title', value: 'Hi' }).success).toBe(
      false,
    );
  });

  it('requires a block id for body edits', () => {
    const result = proposeBodyEditArgsSchema.safeParse({
      newContent: { type: 'paragraph', text: 'New.' },
      reason: 'Tighter.',
    });
    expect(result.success).toBe(false);
  });

  it('parses accepted, rejected-with-reason and stale results', () => {
    expect(proposalResultSchema.parse({ status: 'accepted' })).toEqual({ status: 'accepted' });
    expect(proposalResultSchema.parse({ status: 'rejected', reason: 'Too long' }).status).toBe(
      'rejected',
    );
    expect(proposalResultSchema.safeParse({ status: 'maybe' }).success).toBe(false);
  });

  it('exports AG-UI tool definitions with JSON Schema parameters', () => {
    const defs = frontendToolDefinitions();
    expect(defs.map((d) => d.name)).toEqual(['proposeFieldValue', 'proposeBodyEdit']);
    expect(defs[0]?.parameters).toMatchObject({
      type: 'object',
      required: ['field', 'value', 'reason'],
    });
  });
});
