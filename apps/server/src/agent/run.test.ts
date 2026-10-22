import { verifyEvents } from '@ag-ui/client';
import { EventType, type BaseEvent } from '@ag-ui/core';
import { EventSchema } from '@ag-ui/core/schemas';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import { checkResultSchema } from '@margin/shared';
import { from, lastValueFrom, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { createMockModel } from './mock-model';
import { runAgent } from './run';
import { testRequest } from '../testing/test-request';

async function collect(
  messages: Parameters<typeof testRequest>[0],
  model?: LanguageModelV4,
  request = testRequest(messages),
) {
  const events: BaseEvent[] = [];
  for await (const event of runAgent({
    request,
    model: model ?? createMockModel(request),
    maxOutputTokens: 1000,
  })) {
    // Every event must be valid AG-UI.
    expect(EventSchema.safeParse(event).success, JSON.stringify(event)).toBe(true);
    events.push(event);
  }
  // And the whole stream must pass the AG-UI client's own ordering rules.
  await lastValueFrom(from(events).pipe(verifyEvents(false), toArray()));
  return events;
}

const types = (events: BaseEvent[]) => events.map((e) => e.type);
const ask = (content: string) => [{ id: 'u1', role: 'user' as const, content }];

describe('runAgent', () => {
  it('streams text, then a proposal, and finishes with it pending', async () => {
    const events = await collect(ask('Write a meta description'));
    expect(types(events)).toEqual([
      EventType.RUN_STARTED,
      EventType.TEXT_MESSAGE_START,
      ...Array(5).fill(EventType.TEXT_MESSAGE_CONTENT),
      EventType.TEXT_MESSAGE_END,
      EventType.TOOL_CALL_START,
      EventType.TOOL_CALL_ARGS,
      EventType.TOOL_CALL_END,
      EventType.RUN_FINISHED,
    ]);
    const start = events.find((e) => e.type === EventType.TOOL_CALL_START) as BaseEvent & {
      toolCallId: string;
      toolCallName: string;
    };
    expect(start.toolCallName).toBe('proposeFieldValue');
    const args = events.find((e) => e.type === EventType.TOOL_CALL_ARGS) as BaseEvent & {
      delta: string;
    };
    expect(JSON.parse(args.delta)).toMatchObject({ field: 'metaDescription' });
    expect(events.at(-1)).toMatchObject({
      outcome: { type: 'success', pendingToolCallIds: [start.toolCallId] },
    });
  });

  it('handles two proposals in one turn', async () => {
    const events = await collect(ask('Suggest a title and tags'));
    const starts = events.filter((e) => e.type === EventType.TOOL_CALL_START);
    const ends = events.filter((e) => e.type === EventType.TOOL_CALL_END);
    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
    expect(
      (events.at(-1) as unknown as { outcome: { pendingToolCallIds: string[] } }).outcome
        .pendingToolCallIds,
    ).toHaveLength(2);
  });

  it('answers a tool result with text only and nothing pending', async () => {
    const events = await collect([
      ...ask('Write a meta description'),
      {
        id: 'a1',
        role: 'assistant',
        toolCalls: [
          { id: 'c1', type: 'function', function: { name: 'proposeFieldValue', arguments: '{}' } },
        ],
      },
      {
        id: 't1',
        role: 'tool',
        toolCallId: 'c1',
        content: '{"status":"rejected","reason":"Too long"}',
      },
    ]);
    expect(types(events)).not.toContain(EventType.TOOL_CALL_START);
    expect(events.at(-1)).toEqual({
      type: EventType.RUN_FINISHED,
      threadId: 'thread-1',
      runId: 'run-1',
      outcome: { type: 'success' },
    });
    const text = events
      .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      .map((e) => (e as BaseEvent & { delta: string }).delta)
      .join('');
    expect(text).toBe('OK, I left it unchanged. Noted: Too long');
  });

  it('sends the document and rules in the system prompt', async () => {
    const request = testRequest(ask('Hello'));
    const model = createMockModel(request);
    let prompt = '';
    const spy: LanguageModelV4 = {
      ...model,
      doStream: (options) => {
        prompt = JSON.stringify(options.prompt);
        return model.doStream(options);
      },
    };
    await collect(ask('Hello'), spy);
    expect(prompt).toContain('Never invent facts');
    expect(prompt).toContain('"blockId\\":\\"p2');
  });

  it('reports token usage once per run', async () => {
    const request = testRequest(ask('Hello'));
    const usages: unknown[] = [];
    const events = runAgent({
      request,
      model: createMockModel(request),
      maxOutputTokens: 1000,
      onUsage: (u) => usages.push(u),
    });
    for await (const event of events) expect(event).toBeDefined();
    expect(usages).toHaveLength(1);
    expect(usages[0]).toHaveProperty('outputTokens');
  });

  it('runs a server check, streams its result, then proposes a fix in the same run', async () => {
    const request = testRequest(ask('Check accessibility'));
    request.state.document.body.push({ blockId: 'img1', type: 'image', text: '![](/chart.svg)' });
    const events = await collect(request.messages, undefined, request);

    const starts = events.filter((e) => e.type === EventType.TOOL_CALL_START) as (BaseEvent & {
      toolCallId: string;
      toolCallName: string;
    })[];
    expect(starts.map((s) => s.toolCallName)).toEqual(['a11yCheck', 'proposeBodyEdit']);

    const result = events.find((e) => e.type === EventType.TOOL_CALL_RESULT) as BaseEvent & {
      toolCallId: string;
      content: string;
    };
    expect(result.toolCallId).toBe(starts[0]?.toolCallId);
    const parsed = checkResultSchema.parse(JSON.parse(result.content));
    expect(parsed.issues.map((i) => i.rule)).toEqual(['image-alt-missing']);

    const text = events
      .filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      .map((e) => (e as BaseEvent & { delta: string }).delta)
      .join('');
    expect(text).toContain('Accessibility check: Found 1 error.');
    // Only the proposal waits for the browser; the check answered itself.
    expect(events.at(-1)).toMatchObject({
      outcome: { pendingToolCallIds: [starts[1]?.toolCallId] },
    });
  });

  it('gives each model step its own assistant message', async () => {
    const request = testRequest(ask('Check accessibility'));
    request.state.document.body.push({ blockId: 'img1', type: 'image', text: '![](/chart.svg)' });
    const events = await collect(request.messages, undefined, request);
    const textIds = new Set(
      events
        .filter((e) => e.type === EventType.TEXT_MESSAGE_START)
        .map((e) => (e as BaseEvent & { messageId: string }).messageId),
    );
    expect(textIds.size).toBe(2);
  });

  it('runs seoCheck and proposes the missing meta description', async () => {
    const events = await collect(ask('Check SEO'));
    const names = events
      .filter((e) => e.type === EventType.TOOL_CALL_START)
      .map((e) => (e as BaseEvent & { toolCallName: string }).toolCallName);
    expect(names).toEqual(['seoCheck', 'proposeFieldValue']);
  });

  it('turns a model failure into RUN_ERROR without leaking details', async () => {
    const failing: LanguageModelV4 = {
      ...createMockModel(testRequest(ask('x'))),
      doStream: () => Promise.reject(new Error('secret upstream detail')),
    };
    const events = await collect(ask('x'), failing);
    expect(events.at(-1)).toMatchObject({ type: EventType.RUN_ERROR, code: 'agent_error' });
    expect(JSON.stringify(events)).not.toContain('secret upstream detail');
  });
});
