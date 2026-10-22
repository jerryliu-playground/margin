import { describe, expect, it } from 'vitest';
import { createAgentSession } from './agent-session';
import { FakeAgent, fakeHost, finished, started, text, toolCall } from './testing/fake-agent';

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

  it('applies an accepted proposal through the host and continues the run', async () => {
    const host = fakeHost();
    const agent = new FakeAgent([
      (i) => [
        started(i),
        ...toolCall('c1', 'proposeFieldValue', { field: 'title', value: 'Hi', reason: 'Shorter.' }),
        finished(i, ['c1']),
      ],
      (i) => [started(i), ...text('m2', 'Done.'), finished(i)],
    ]);
    const session = createAgentSession({ host, agentUrl: 'http://x', createAgent: () => agent });
    await session.send('Shorter title');
    expect(session.getSnapshot().proposals).toEqual([
      expect.objectContaining({
        toolCallId: 'c1',
        status: 'pending',
        before: 'Hello',
        after: 'Hi',
      }),
    ]);
    expect(agent.inputs).toHaveLength(1);

    await session.accept('c1');
    expect(host.fields.title).toBe('Hi');
    expect(session.getSnapshot().proposals[0]?.status).toBe('accepted');
    expect(agent.inputs[1]?.messages.at(-1)).toMatchObject({
      role: 'tool',
      toolCallId: 'c1',
      content: '{"status":"accepted"}',
    });
  });

  it('waits for every proposal of a turn, then answers them together', async () => {
    const host = fakeHost();
    const agent = new FakeAgent([
      (i) => [
        started(i),
        ...toolCall('c1', 'proposeFieldValue', { field: 'title', value: 'A', reason: 'r' }),
        ...toolCall('c2', 'proposeFieldValue', {
          field: 'metaDescription',
          value: 'B',
          reason: 'r',
        }),
        finished(i, ['c1', 'c2']),
      ],
      (i) => [started(i), finished(i)],
    ]);
    const session = createAgentSession({ host, agentUrl: 'http://x', createAgent: () => agent });
    await session.send('Two things');
    await session.reject('c2', 'Too vague');
    expect(agent.inputs).toHaveLength(1);
    expect(host.fields.metaDescription).toBe('');
    await session.accept('c1');
    const tools = agent.inputs[1]?.messages.filter((m) => m.role === 'tool');
    expect(tools?.map((m) => [m.toolCallId, m.content])).toEqual([
      ['c1', '{"status":"accepted"}'],
      ['c2', '{"status":"rejected","reason":"Too vague"}'],
    ]);
  });

  it('marks a body proposal outdated when its block changes, and dismisses it as stale', async () => {
    const host = fakeHost();
    const agent = new FakeAgent([
      (i) => [
        started(i),
        ...toolCall('c1', 'proposeBodyEdit', {
          blockId: 'p1',
          newContent: { type: 'paragraph', text: 'Short.' },
          reason: 'Tighter.',
        }),
        finished(i, ['c1']),
      ],
      (i) => [started(i), finished(i)],
    ]);
    const session = createAgentSession({ host, agentUrl: 'http://x', createAgent: () => agent });
    await session.send('Tighten');
    host.editBlock('p1', 'Typed by the user.');
    expect(session.getSnapshot().outdated.has('c1')).toBe(true);

    await session.accept('c1'); // refused: the block changed
    expect(host.blocks[0]?.text).toBe('Typed by the user.');
    expect(session.getSnapshot().proposals[0]?.status).toBe('stale');
    expect(agent.inputs[1]?.messages.at(-1)).toMatchObject({ content: '{"status":"stale"}' });
  });

  it('answers an invalid proposal automatically without showing a card', async () => {
    const agent = new FakeAgent([
      (i) => [
        started(i),
        ...toolCall('c1', 'proposeFieldValue', { field: 'nope', value: 'x', reason: 'r' }),
        finished(i, ['c1']),
      ],
      (i) => [started(i), ...text('m2', 'Sorry.'), finished(i)],
    ]);
    const session = createAgentSession({
      host: fakeHost(),
      agentUrl: 'http://x',
      createAgent: () => agent,
    });
    await session.send('Do something');
    expect(session.getSnapshot().proposals).toEqual([]);
    expect(agent.inputs[1]?.messages.at(-1)?.content).toContain('Invalid proposal: Unknown field');
  });

  it('leaves server check calls alone: no card and no answer from the browser', async () => {
    const agent = new FakeAgent([
      (i) => [
        started(i),
        ...toolCall('s1', 'a11yCheck', {}),
        {
          type: 'TOOL_CALL_RESULT',
          messageId: 'r1',
          toolCallId: 's1',
          role: 'tool',
          content: '{"summary":"No accessibility issues found.","issues":[]}',
        } as never,
        ...text('m2', 'All good.'),
        finished(i),
      ],
    ]);
    const session = createAgentSession({
      host: fakeHost(),
      agentUrl: 'http://x',
      createAgent: () => agent,
    });
    const seen = new Set<string>();
    session.subscribe(() => seen.add(session.getSnapshot().activity));
    await session.send('Check accessibility');
    expect(seen).toContain('checking-a11y');
    expect(session.getSnapshot().proposals).toEqual([]);
    expect(agent.inputs).toHaveLength(1);
    const tools = session.getSnapshot().messages.filter((m) => m.role === 'tool');
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({ toolCallId: 's1' });
  });

  describe('undo', () => {
    const fieldTurn = () =>
      new FakeAgent([
        (i) => [
          started(i),
          ...toolCall('c1', 'proposeFieldValue', { field: 'title', value: 'Hi', reason: 'r' }),
          finished(i, ['c1']),
        ],
        (i) => [started(i), finished(i)],
      ]);
    const bodyTurn = () =>
      new FakeAgent([
        (i) => [
          started(i),
          ...toolCall('c1', 'proposeBodyEdit', {
            blockId: 'p1',
            newContent: { type: 'paragraph', text: 'Short.' },
            reason: 'r',
          }),
          finished(i, ['c1']),
        ],
        (i) => [started(i), finished(i)],
      ]);

    it('restores a field to its value before the proposal', async () => {
      const host = fakeHost();
      const session = createAgentSession({ host, agentUrl: 'http://x', createAgent: fieldTurn });
      await session.send('Title');
      await session.accept('c1');
      expect(host.fields.title).toBe('Hi');
      await session.undo('c1');
      expect(host.fields.title).toBe('Hello');
      expect(session.getSnapshot().proposals[0]?.status).toBe('undone');
    });

    it('restores a block', async () => {
      const host = fakeHost();
      const session = createAgentSession({ host, agentUrl: 'http://x', createAgent: bodyTurn });
      await session.send('Tighten');
      await session.accept('c1');
      expect(host.blocks[0]?.text).toBe('Short.');
      await session.undo('c1');
      expect(host.blocks[0]).toEqual({
        blockId: 'p1',
        type: 'paragraph',
        text: 'One long sentence here.',
      });
    });

    it('refuses when the value changed after Accept, and changes nothing', async () => {
      const host = fakeHost();
      const session = createAgentSession({ host, agentUrl: 'http://x', createAgent: bodyTurn });
      await session.send('Tighten');
      await session.accept('c1');
      host.editBlock('p1', 'Short. And more typing.');
      await session.undo('c1');
      expect(host.blocks[0]?.text).toBe('Short. And more typing.');
      expect(session.getSnapshot().proposals[0]).toMatchObject({
        status: 'accepted',
        undoError: expect.stringContaining('can no longer be undone'),
      });
    });

    it('ignores undo on a proposal that was not accepted', async () => {
      const host = fakeHost();
      const session = createAgentSession({ host, agentUrl: 'http://x', createAgent: fieldTurn });
      await session.send('Title');
      await session.undo('c1');
      expect(session.getSnapshot().proposals[0]?.status).toBe('pending');
    });
  });

  it("shows the server's message when the request is refused", async () => {
    const refusing = new FakeAgent([]);
    refusing.run = () => {
      const error = Object.assign(new Error('HTTP 429: …'), {
        status: 429,
        payload: {
          error: { code: 'daily_limit', message: "The demo has used today's agent runs." },
        },
      });
      throw error;
    };
    const session = createAgentSession({
      host: fakeHost(),
      agentUrl: 'http://x',
      createAgent: () => refusing,
    });
    await session.send('Hi');
    expect(session.getSnapshot().error).toBe("The demo has used today's agent runs.");
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
