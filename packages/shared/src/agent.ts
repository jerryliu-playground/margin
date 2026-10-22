import { z } from 'zod';
import { documentStateSchema, fieldDescriptorSchema } from './editor-host';

/** Shared state sent with every run: the host's field list plus the current document. */
export const agentStateSchema = z.object({
  schema: z.array(fieldDescriptorSchema).max(50),
  document: documentStateSchema,
});
export type AgentState = z.infer<typeof agentStateSchema>;

export const AGENT_LIMITS = { messages: 100, messageChars: 20_000, tools: 20 } as const;

const content = z.string().max(AGENT_LIMITS.messageChars);

const toolCallSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal('function'),
  function: z.looseObject({
    name: z.string().min(1),
    arguments: z.string().max(AGENT_LIMITS.messageChars),
  }),
});

/**
 * Messages a client may send. System and developer messages are not accepted:
 * the server owns the system prompt.
 */
export const agentMessageSchema = z.discriminatedUnion('role', [
  z.looseObject({ id: z.string().min(1), role: z.literal('user'), content }),
  z.looseObject({
    id: z.string().min(1),
    role: z.literal('assistant'),
    content: content.optional(),
    toolCalls: z.array(toolCallSchema).optional(),
  }),
  z.looseObject({
    id: z.string().min(1),
    role: z.literal('tool'),
    toolCallId: z.string().min(1),
    content,
  }),
]);
export type AgentMessage = z.infer<typeof agentMessageSchema>;

export const agentToolSchema = z.looseObject({
  name: z.string().min(1),
  description: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Things the user did that the history cannot show. Structured on purpose: the server
 * turns them into fixed sentences, so no client text reaches the system prompt.
 */
export const editorEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('undo-field'),
    field: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
  }),
  z.object({ type: z.literal('undo-block'), blockId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }),
]);
export type EditorEvent = z.infer<typeof editorEventSchema>;

/** The only AG-UI context description the server accepts. */
export const EDITOR_EVENTS_CONTEXT = 'Editor events since your last turn';

const editorEventListSchema = z.array(editorEventSchema).max(20);

function parseEvents(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** AG-UI `Context`: `value` must be a JSON list of editor events. */
export const agentContextSchema = z.object({
  description: z.literal(EDITOR_EVENTS_CONTEXT),
  value: z
    .string()
    .max(2000)
    .refine((v) => editorEventListSchema.safeParse(parseEvents(v)).success, {
      message: 'context value must be a JSON list of editor events',
    }),
});
export type AgentContext = z.infer<typeof agentContextSchema>;

/** The editor events carried by a request's context (already validated by the schema). */
export function editorEventsOf(context: AgentContext[]): EditorEvent[] {
  return context.flatMap((c) => editorEventListSchema.parse(parseEvents(c.value)));
}

/** POST /agent body: the subset of AG-UI `RunAgentInput` that Margin uses. */
export const agentRunRequestSchema = z.looseObject({
  threadId: z.string().min(1),
  runId: z.string().min(1),
  state: agentStateSchema,
  messages: z.array(agentMessageSchema).min(1).max(AGENT_LIMITS.messages),
  tools: z.array(agentToolSchema).max(AGENT_LIMITS.tools).default([]),
  /** AG-UI `context`: facts from the editor, e.g. that the user undid an accepted proposal. */
  context: z.array(agentContextSchema).max(10).default([]),
});
export type AgentRunRequest = z.infer<typeof agentRunRequestSchema>;
