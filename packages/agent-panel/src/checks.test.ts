import type { Message } from '@ag-ui/client';
import { describe, expect, it } from 'vitest';
import { checkEntries } from './checks';

const call = (id: string, name: string): Message => ({
  id: `a-${id}`,
  role: 'assistant',
  toolCalls: [{ id, type: 'function', function: { name, arguments: '{}' } }],
});

describe('checkEntries', () => {
  it('finds server check results and ignores proposal answers and bad content', () => {
    const messages: Message[] = [
      call('s1', 'a11yCheck'),
      {
        id: 't1',
        role: 'tool',
        toolCallId: 's1',
        content: '{"summary":"Found 1 error.","issues":[]}',
      },
      call('p1', 'proposeFieldValue'),
      { id: 't2', role: 'tool', toolCallId: 'p1', content: '{"status":"accepted"}' },
      call('s2', 'seoCheck'),
      { id: 't3', role: 'tool', toolCallId: 's2', content: 'not json' },
    ];
    const entries = checkEntries(messages);
    expect([...entries.keys()]).toEqual(['t1']);
    expect(entries.get('t1')).toMatchObject({
      toolName: 'a11yCheck',
      result: { summary: 'Found 1 error.' },
    });
  });
});
