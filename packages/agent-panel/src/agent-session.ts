import { HttpAgent, type AbstractAgent, type AgentSubscriber, type Message } from '@ag-ui/client';
import { frontendToolDefinitions, type AgentState, type EditorHost } from '@margin/shared';

/** What the panel shows about the current run. */
export type Activity = 'idle' | 'reading' | 'writing' | 'proposing';

/** A frontend tool call the agent made, waiting for the user (proposal cards build on this). */
export interface ToolCallRequest {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface SessionSnapshot {
  messages: readonly Message[];
  activity: Activity;
  running: boolean;
  error?: string | undefined;
  toolCalls: readonly ToolCallRequest[];
}

export interface AgentSessionOptions {
  host: EditorHost;
  /** Base URL of the agent server. */
  agentUrl: string;
  /** For tests: supply any AG-UI agent instead of the HTTP one. */
  createAgent?: (url: string) => AbstractAgent;
}

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++idCounter}`;

/**
 * The panel's AG-UI client (ADR 0002). Framework-free, so it is unit-tested with fake
 * event streams; React reads it through useAgentSession.
 */
export function createAgentSession({ host, agentUrl, createAgent }: AgentSessionOptions) {
  const url = `${agentUrl.replace(/\/$/, '')}/agent`;
  const agent = createAgent ? createAgent(url) : new HttpAgent({ url });
  const listeners = new Set<() => void>();
  let snapshot: SessionSnapshot = { messages: [], activity: 'idle', running: false, toolCalls: [] };

  const update = (patch: Partial<SessionSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((l) => l());
  };

  const subscriber: AgentSubscriber = {
    onRunStartedEvent: () => update({ activity: 'reading' }),
    onTextMessageContentEvent: () => {
      if (snapshot.activity !== 'writing') update({ activity: 'writing' });
    },
    onToolCallStartEvent: () => update({ activity: 'proposing' }),
    onToolCallEndEvent: ({ event, toolCallName, toolCallArgs }) =>
      update({
        toolCalls: [
          ...snapshot.toolCalls,
          { toolCallId: event.toolCallId, toolName: toolCallName, args: toolCallArgs },
        ],
      }),
    onMessagesChanged: ({ messages }) => update({ messages: [...messages] }),
    onRunErrorEvent: ({ event }) => update({ error: event.message }),
  };

  async function run(): Promise<void> {
    update({ running: true, activity: 'reading', error: undefined });
    try {
      if (agent instanceof HttpAgent) {
        agent.headers = { authorization: `Bearer ${await host.getAuthToken()}` };
      }
      const state: AgentState = { schema: host.getSchema(), document: host.getState() };
      agent.setState(state);
      await agent.runAgent({ runId: newId('run'), tools: frontendToolDefinitions() }, subscriber);
    } catch (error) {
      update({
        error: snapshot.error ?? `The agent is not reachable: ${(error as Error).message}`,
      });
    } finally {
      update({ running: false, activity: 'idle', messages: [...agent.messages] });
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Sends a user message and starts a run. Ignored while a run is active. */
    async send(text: string): Promise<void> {
      const content = text.trim();
      if (!content || snapshot.running) return;
      agent.addMessage({ id: newId('user'), role: 'user', content });
      update({ messages: [...agent.messages] });
      await run();
    },
    /** Adds tool results (the user's answers) and continues the conversation. */
    async answer(results: { toolCallId: string; content: string }[]): Promise<void> {
      for (const r of results) {
        agent.addMessage({
          id: newId('tool'),
          role: 'tool',
          toolCallId: r.toolCallId,
          content: r.content,
        });
      }
      const answered = new Set(results.map((r) => r.toolCallId));
      update({
        messages: [...agent.messages],
        toolCalls: snapshot.toolCalls.filter((c) => !answered.has(c.toolCallId)),
      });
      await run();
    },
    stop: () => agent.abortRun(),
  };
}

export type AgentSession = ReturnType<typeof createAgentSession>;
