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

export const agentContextSchema = z.looseObject({
  description: z.string().min(1).max(200),
  value: z.string().max(2000),
});
export type AgentContext = z.infer<typeof agentContextSchema>;

/** The description the panel uses for editor events since the agent's last turn. */
export const EDITOR_EVENTS_CONTEXT = 'Editor events since your last turn';

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
