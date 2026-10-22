import { describe, expect, it } from 'vitest';
import { toModelMessages } from './messages';

const call = (id: string) => ({
  id: `a-${id}`,
  role: 'assistant' as const,
  toolCalls: [
    {
      id,
      type: 'function' as const,
      function: { name: 'proposeFieldValue', arguments: '{"field":"title"}' },
    },
  ],
});

describe('toModelMessages', () => {
  it('maps user, assistant tool calls and tool results', () => {
    const out = toModelMessages([
      { id: 'u1', role: 'user', content: 'Title?' },
      call('c1'),
      { id: 't1', role: 'tool', toolCallId: 'c1', content: '{"status":"accepted"}' },
    ]);
    expect(out).toEqual([
      { role: 'user', content: 'Title?' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'proposeFieldValue',
            input: { field: 'title' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'c1',
            toolName: 'proposeFieldValue',
            output: { type: 'text', value: '{"status":"accepted"}' },
          },
        ],
      },
    ]);
  });

  it('closes an unanswered tool call as rejected before the next user message', () => {
    const out = toModelMessages([
      { id: 'u1', role: 'user', content: 'Title?' },
      call('c1'),
      { id: 'u2', role: 'user', content: 'Never mind.' },
    ]);
    expect(out[2]).toMatchObject({
      role: 'tool',
      content: [{ toolCallId: 'c1', output: { value: expect.stringContaining('rejected') } }],
    });
    expect(out[3]).toEqual({ role: 'user', content: 'Never mind.' });
  });

  it('drops a tool result for a call that does not exist', () => {
    const out = toModelMessages([
      { id: 'u1', role: 'user', content: 'Hi' },
      { id: 't1', role: 'tool', toolCallId: 'ghost', content: '{}' },
    ]);
    expect(out).toEqual([{ role: 'user', content: 'Hi' }]);
  });
});
