/**
 * Spike for ADR 0002/0003: proves the approval round trip works with the AI SDK.
 * 1. A frontend tool (no `execute`) makes the run stop at the tool call.
 * 2. Sending the user's answer back as a `tool` message in a new run lets the agent continue.
 * Uses MockLanguageModelV4, so no real model is called (CLAUDE.md rule 5).
 */
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { proposeFieldValueArgsSchema, type ProposalResult } from '@margin/shared';
import { simulateReadableStream, streamText, tool, type ModelMessage } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function streamOf(chunks: LanguageModelV4StreamPart[]) {
  return { stream: simulateReadableStream<LanguageModelV4StreamPart>({ chunks }) };
}

const proposalCall = streamOf([
  {
    type: 'tool-call',
    toolCallId: 'call-1',
    toolName: 'proposeFieldValue',
    input: JSON.stringify({
      field: 'metaDescription',
      value: 'A short guide to tightening prose.',
      reason: 'Fits under 160 characters.',
    }),
  },
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage },
]);

const followUp = streamOf([
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'Done. The meta description is set.' },
  { type: 'text-end', id: 't1' },
  { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage },
]);

const tools = {
  // No `execute`: this is a frontend tool, the browser answers it.
  proposeFieldValue: tool({
    description: 'Suggest a new value for one document field.',
    inputSchema: proposeFieldValueArgsSchema,
  }),
};

describe('frontend tool round trip (spike)', () => {
  it('stops at the tool call, then continues after the tool result', async () => {
    const model = new MockLanguageModelV4({ doStream: [proposalCall, followUp] });
    const messages: ModelMessage[] = [{ role: 'user', content: 'Write a meta description.' }];

    // Run 1: the agent proposes and the run ends, waiting for the user.
    const run1 = streamText({ model, tools, messages });
    await run1.consumeStream();
    expect(await run1.finishReason).toBe('tool-calls');
    const [call] = await run1.toolCalls;
    expect(call?.toolName).toBe('proposeFieldValue');
    expect(call?.input).toMatchObject({ field: 'metaDescription' });
    expect(await run1.toolResults).toEqual([]);

    // The user accepts in the browser. Run 2 carries the answer as a tool message.
    const answer: ProposalResult = { status: 'accepted' };
    const run2 = streamText({
      model,
      tools,
      messages: [
        ...messages,
        ...(await run1.response).messages,
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'proposeFieldValue',
              output: { type: 'json', value: answer },
            },
          ],
        },
      ],
    });
    expect(await run2.text).toBe('Done. The meta description is set.');
    expect(await run2.finishReason).toBe('stop');

    // The model saw the tool result in its prompt on the second call.
    const secondPrompt = JSON.stringify(model.doStreamCalls[1]?.prompt);
    expect(secondPrompt).toContain('"toolCallId":"call-1"');
    expect(secondPrompt).toContain('accepted');
  });
});
