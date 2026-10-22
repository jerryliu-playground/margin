import { AbstractAgent, EventType, type BaseEvent, type RunAgentInput } from '@ag-ui/client';
import type { EditorHost } from '@margin/shared';
import { Observable } from 'rxjs';

/** Test double: plays scripted AG-UI events, one script per run, and records each input. */
export class FakeAgent extends AbstractAgent {
  inputs: RunAgentInput[] = [];
  constructor(private scripts: ((input: RunAgentInput) => BaseEvent[])[]) {
    super();
  }
  run(input: RunAgentInput): Observable<BaseEvent> {
    this.inputs.push(input);
    const script = this.scripts.shift();
    if (!script) throw new Error('FakeAgent: no script left for this run.');
    const events = script(input);
    return new Observable((sub) => {
      for (const e of events) sub.next(e);
      sub.complete();
    });
  }
}

export const started = (input: RunAgentInput): BaseEvent =>
  ({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId }) as BaseEvent;
export const finished = (input: RunAgentInput, pending: string[] = []): BaseEvent =>
  ({
    type: EventType.RUN_FINISHED,
    threadId: input.threadId,
    runId: input.runId,
    outcome: pending.length
      ? { type: 'success', pendingToolCallIds: pending }
      : { type: 'success' },
  }) as BaseEvent;
export const text = (messageId: string, delta: string): BaseEvent[] => [
  { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' } as BaseEvent,
  { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta } as BaseEvent,
  { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent,
];
export const toolCall = (
  toolCallId: string,
  name: string,
  args: unknown,
  parentMessageId?: string,
): BaseEvent[] => [
  {
    type: EventType.TOOL_CALL_START,
    toolCallId,
    toolCallName: name,
    ...(parentMessageId ? { parentMessageId } : {}),
  } as BaseEvent,
  { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(args) } as BaseEvent,
  { type: EventType.TOOL_CALL_END, toolCallId } as BaseEvent,
];

/** In-memory EditorHost for panel tests. */
export interface FakeHost extends EditorHost {
  fields: Record<string, unknown>;
  blocks: { blockId: string; type: string; text: string }[];
  /** Simulates the user typing into a block. */
  editBlock(blockId: string, text: string): void;
}

export function fakeHost(): FakeHost {
  const listeners = new Set<(s: ReturnType<EditorHost['getState']>) => void>();
  const host = {
    fields: { title: 'Hello', metaDescription: '' } as Record<string, unknown>,
    blocks: [{ blockId: 'p1', type: 'paragraph', text: 'One long sentence here.' }],
    state: undefined as ReturnType<EditorHost['getState']> | undefined,
    getSchema: () => [
      { name: 'title', label: 'Title', kind: 'text' as const, maxLength: 20 },
      { name: 'metaDescription', label: 'Meta description', kind: 'textarea' as const },
    ],
    getState() {
      host.state ??= {
        fields: { ...host.fields } as never,
        body: host.blocks.map((b) => ({ ...b })),
      };
      return host.state;
    },
    changed() {
      host.state = undefined;
      const s = host.getState();
      listeners.forEach((l) => l(s));
    },
    subscribe(l: (s: ReturnType<EditorHost['getState']>) => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    async applyFieldValue(name: string, value: unknown) {
      host.fields[name] = value;
      host.changed();
    },
    async applyBodyEdit(blockId: string, block: { type: string; text: string }) {
      host.blocks = host.blocks.map((b) => (b.blockId === blockId ? { blockId, ...block } : b));
      host.changed();
    },
    getAuthToken: () => Promise.resolve('test-token'),
    editBlock(blockId: string, text: string) {
      host.blocks = host.blocks.map((b) => (b.blockId === blockId ? { ...b, text } : b));
      host.changed();
    },
  };
  return host;
}
