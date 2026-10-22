import type { Message } from '@ag-ui/client';
import {
  checkResultSchema,
  serverTools,
  type CheckResult,
  type ServerToolName,
} from '@margin/shared';

export interface CheckEntry {
  messageId: string;
  toolName: ServerToolName;
  result: CheckResult;
}

export const CHECK_TITLE: Record<ServerToolName, string> = {
  a11yCheck: 'Accessibility check',
  seoCheck: 'SEO check',
};

/** Server check results in the conversation, keyed by the tool message that carries them. */
export function checkEntries(messages: readonly Message[]): Map<string, CheckEntry> {
  const names = new Map<string, string>();
  for (const m of messages) {
    if (m.role === 'assistant') for (const c of m.toolCalls ?? []) names.set(c.id, c.function.name);
  }
  const entries = new Map<string, CheckEntry>();
  for (const m of messages) {
    if (m.role !== 'tool') continue;
    const toolName = names.get(m.toolCallId);
    if (!toolName || !(toolName in serverTools) || typeof m.content !== 'string') continue;
    try {
      const parsed = checkResultSchema.safeParse(JSON.parse(m.content));
      if (parsed.success) {
        entries.set(m.id, {
          messageId: m.id,
          toolName: toolName as ServerToolName,
          result: parsed.data,
        });
      }
    } catch {
      // A result that is not JSON (e.g. an error string) is simply not shown as a check.
    }
  }
  return entries;
}
