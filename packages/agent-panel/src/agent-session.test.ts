import { describe, expect, it } from 'vitest';
import { createAgentSession } from './agent-session';
import { FakeAgent, fakeHost, finished, started, text, toolCall } from './fake-agent';

describe('agent session', () => {
  it('sends the document as shared state and the frontend tools', async () => {
    const agent = new FakeAgent([(i) => [started(i), ...text('m1', 'Hi.'), finished(i)]]);
    const session = createAgentSession({
      host: fakeHost(),
      agentUrl: 'http://x',
      createAgent: () => agent,
    });
    await session.send('Hello');
    const input = agent.inputs[0];
    expect(input?.state).toMatchObject({
      schema: [{ name: 'title' }, { name: 'metaDescription' }],
      document: { fields: { title: 'Hello' }, body: [{ blockId: 'p1' }] },
    });
    expect(input?.tools.map((t) => t.name)).toEqual(['proposeFieldValue', 'proposeBodyEdit']);
    expect(input?.messages).toEqual([expect.objectContaining({ role: 'user', content: 'Hello' })]);
  });

  it('accumulates streamed text into an assistant message and ends idle', async () => {
    const agent = new FakeAgent([(i) => [started(i), ...text('m1', 'Hello there.'), finished(i)]]);
    const session = createAgentSession({
      host: fakeHost(),
      agentUrl: 'http://x',
      createAgent: () => agent,
    });
    const seen = new Set<string>();
    session.subscribe(() => seen.add(session.getSnapshot().activity));
    await session.send('Hi');
    const snap = session.getSnapshot();
    expect(snap.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Hi'],
      ['assistant', 'Hello there.'],
    ]);
    expect(snap.running).toBe(false);
    expect(snap.activity).toBe('idle');
    expect(seen).toContain('reading');
    expect(seen).toContain('writing');
  });

  it('collects tool calls and sends answers as tool messages in the next run', async () => {
    const agent = new FakeAgent([
      (i) => [
        started(i),
        ...toolCall('c1', 'proposeFieldValue', { field: 'title', value: 'Hi', reason: 'Shorter.' }),
        finished(i, ['c1']),
      ],
      (i) => [started(i), ...text('m2', 'Done.'), finished(i)],
    ]);
    const session = createAgentSession({
      host: fakeHost(),
      agentUrl: 'http://x',
      createAgent: () => agent,
    });
    await session.send('Shorter title');
    expect(session.getSnapshot().toolCalls).toEqual([
      {
        toolCallId: 'c1',
        toolName: 'proposeFieldValue',
        args: { field: 'title', value: 'Hi', reason: 'Shorter.' },
      },
    ]);

    await session.answer([{ toolCallId: 'c1', content: '{"status":"accepted"}' }]);
    const second = agent.inputs[1];
    expect(second?.messages.at(-1)).toMatchObject({
      role: 'tool',
      toolCallId: 'c1',
      content: '{"status":"accepted"}',
    });
    expect(session.getSnapshot().toolCalls).toEqual([]);
  });

  it('shows a run error', async () => {
    const agent = new FakeAgent([
      (i) => [
        started(i),
        { type: 'RUN_ERROR', message: 'The agent hit an error. Try again.' } as never,
      ],
    ]);
    const session = createAgentSession({
      host: fakeHost(),
      agentUrl: 'http://x',
      createAgent: () => agent,
    });
    await session.send('Hi');
    expect(session.getSnapshot().error).toBe('The agent hit an error. Try again.');
    expect(session.getSnapshot().running).toBe(false);
  });

  it('ignores empty messages and messages sent while running', async () => {
    const agent = new FakeAgent([(i) => [started(i), finished(i)]]);
    const session = createAgentSession({
      host: fakeHost(),
      agentUrl: 'http://x',
      createAgent: () => agent,
    });
    await session.send('   ');
    expect(agent.inputs).toHaveLength(0);
    const first = session.send('One');
    await session.send('Two');
    await first;
    expect(agent.inputs).toHaveLength(1);
  });
});
