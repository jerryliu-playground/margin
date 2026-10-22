import { describe, expect, it } from 'vitest';
import { createAgentSession } from './agent-session';
import { TONE_PRESETS } from './presets';
import { FakeAgent, fakeHost, finished, started } from './testing/fake-agent';

describe('tone presets', () => {
  it('are short plain requests that end in a proposal', () => {
    expect(TONE_PRESETS.map((p) => p.label)).toEqual(['More formal', 'Shorter', 'Friendlier']);
    for (const p of TONE_PRESETS) expect(p.prompt).toMatch(/Propose the edit\.$/);
  });

  it('are sent as an ordinary user message', async () => {
    const agent = new FakeAgent([(i) => [started(i), finished(i)]]);
    const session = createAgentSession({
      host: fakeHost(),
      agentUrl: 'http://x',
      createAgent: () => agent,
    });
    await session.send(TONE_PRESETS[1].prompt);
    expect(agent.inputs[0]?.messages.at(-1)).toMatchObject({
      role: 'user',
      content: TONE_PRESETS[1].prompt,
    });
  });
});
