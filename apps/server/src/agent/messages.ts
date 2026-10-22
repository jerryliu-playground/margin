import type { AgentMessage } from '@margin/shared';
import type { ModelMessage } from 'ai';

const UNANSWERED = JSON.stringify({ status: 'rejected', reason: 'The editor did not answer.' });

function parseArgs(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * AG-UI messages -> AI SDK messages. Every tool call gets a result: a call the
 * client never answered is closed as rejected, because the model API requires it.
 */
export function toModelMessages(messages: AgentMessage[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  const toolNames = new Map<string, string>();
  const open = new Set<string>();

  const closeOpen = () => {
    if (open.size === 0) return;
    out.push({
      role: 'tool',
      content: [...open].map((toolCallId) => ({
        type: 'tool-result' as const,
        toolCallId,
        toolName: toolNames.get(toolCallId) ?? 'unknown',
        output: { type: 'text' as const, value: UNANSWERED },
      })),
    });
    open.clear();
  };

  for (const message of messages) {
    if (message.role === 'tool') {
      if (!open.delete(message.toolCallId)) continue; // a result for an unknown call is dropped
      out.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: message.toolCallId,
            toolName: toolNames.get(message.toolCallId) ?? 'unknown',
            output: { type: 'text', value: message.content },
          },
        ],
      });
      continue;
    }
    closeOpen();
    if (message.role === 'user') {
      out.push({ role: 'user', content: message.content });
      continue;
    }
    const calls = message.toolCalls ?? [];
    for (const call of calls) {
      toolNames.set(call.id, call.function.name);
      open.add(call.id);
    }
    out.push({
      role: 'assistant',
      content: [
        ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
        ...calls.map((call) => ({
          type: 'tool-call' as const,
          toolCallId: call.id,
          toolName: call.function.name,
          input: parseArgs(call.function.arguments),
        })),
      ],
    });
  }
  closeOpen();
  return out;
}
