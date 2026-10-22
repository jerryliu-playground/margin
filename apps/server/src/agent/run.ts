import { randomUUID } from 'node:crypto';
import { EventType, type BaseEvent } from '@ag-ui/core';
import { frontendTools, type AgentRunRequest, type FrontendToolName } from '@margin/shared';
import { stepCountIs, streamText, tool, type LanguageModel, type LanguageModelUsage } from 'ai';
import { toModelMessages } from './messages';
import { systemPrompt } from './prompt';

export interface RunOptions {
  request: AgentRunRequest;
  model: LanguageModel;
  maxOutputTokens: number;
  signal?: AbortSignal;
  onError?: (error: unknown) => void;
  /** Token counts for the whole run (numbers only, safe to log). */
  onUsage?: (usage: LanguageModelUsage) => void;
}

const isFrontendTool = (name: string): name is FrontendToolName => name in frontendTools;

/**
 * Frontend tools offered by the client, with our own shared schemas (CLAUDE.md rule 2).
 * They have no `execute`, so the model's turn ends at the call (ADR 0003).
 */
function frontendToolSet(request: AgentRunRequest) {
  const all = {
    proposeFieldValue: tool({
      description: frontendTools.proposeFieldValue.description,
      inputSchema: frontendTools.proposeFieldValue.args,
    }),
    proposeBodyEdit: tool({
      description: frontendTools.proposeBodyEdit.description,
      inputSchema: frontendTools.proposeBodyEdit.args,
    }),
  };
  const offered = new Set(request.tools.map((t) => t.name));
  return Object.fromEntries(Object.entries(all).filter(([name]) => offered.has(name)));
}

/**
 * One AG-UI run: AI SDK stream parts in, AG-UI events out.
 * The run ends with RUN_FINISHED and `pendingToolCallIds` naming the proposals the
 * browser must answer; the answer arrives as a tool message in the next run.
 */
export async function* runAgent({
  request,
  model,
  maxOutputTokens,
  signal,
  onError,
  onUsage,
}: RunOptions) {
  const { threadId, runId } = request;
  yield { type: EventType.RUN_STARTED, threadId, runId } as BaseEvent;

  let messageId = randomUUID();
  let textOpen = false;
  const openCalls = new Set<string>();
  const pending: string[] = [];

  function* closeText(): Generator<BaseEvent> {
    if (!textOpen) return;
    textOpen = false;
    yield { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent;
    messageId = randomUUID();
  }

  try {
    const result = streamText({
      model,
      system: systemPrompt(request.state),
      messages: toModelMessages(request.messages),
      tools: frontendToolSet(request),
      maxOutputTokens,
      stopWhen: stepCountIs(4),
      ...(signal ? { abortSignal: signal } : {}),
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          if (!part.text) break;
          if (!textOpen) {
            textOpen = true;
            yield { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' } as BaseEvent;
          }
          yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: part.text } as BaseEvent;
          break;

        case 'tool-input-start':
          if (!isFrontendTool(part.toolName)) break;
          yield* closeText();
          openCalls.add(part.id);
          // Shown in the panel as "Proposing…" while the arguments are generated.
          yield {
            type: EventType.TOOL_CALL_START,
            toolCallId: part.id,
            toolCallName: part.toolName,
            parentMessageId: messageId,
          } as BaseEvent;
          break;

        case 'tool-call': {
          if (!isFrontendTool(part.toolName)) break;
          if (!openCalls.has(part.toolCallId)) {
            yield* closeText();
            yield {
              type: EventType.TOOL_CALL_START,
              toolCallId: part.toolCallId,
              toolCallName: part.toolName,
              parentMessageId: messageId,
            } as BaseEvent;
          }
          openCalls.delete(part.toolCallId);
          // Arguments are sent once, complete. An invalid call is still sent so the
          // browser can answer it with an error and the model can correct itself.
          yield {
            type: EventType.TOOL_CALL_ARGS,
            toolCallId: part.toolCallId,
            delta: JSON.stringify(part.input ?? {}),
          } as BaseEvent;
          yield { type: EventType.TOOL_CALL_END, toolCallId: part.toolCallId } as BaseEvent;
          pending.push(part.toolCallId);
          break;
        }

        case 'finish-step':
          yield* closeText();
          break;

        case 'finish':
          onUsage?.(part.totalUsage);
          yield* closeText();
          if (part.finishReason === 'content-filter') {
            yield {
              type: EventType.RUN_ERROR,
              message: 'The model declined this request.',
              code: 'refused',
            } as BaseEvent;
            return;
          }
          break;

        case 'error':
          throw part.error;

        default:
          break;
      }
    }

    yield* closeText();
    for (const id of openCalls) {
      // Started but never completed (cut off): close it so the stream stays valid.
      yield { type: EventType.TOOL_CALL_END, toolCallId: id } as BaseEvent;
    }
    yield {
      type: EventType.RUN_FINISHED,
      threadId,
      runId,
      outcome:
        pending.length > 0 ? { type: 'success', pendingToolCallIds: pending } : { type: 'success' },
    } as BaseEvent;
  } catch (error) {
    onError?.(error);
    yield* closeText();
    yield {
      type: EventType.RUN_ERROR,
      message: 'The agent hit an error. Try again.',
      code: 'agent_error',
    } as BaseEvent;
  }
}
