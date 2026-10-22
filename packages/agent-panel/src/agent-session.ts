import { HttpAgent, type AbstractAgent, type AgentSubscriber, type Message } from '@ag-ui/client';
import {
  apiErrorSchema,
  frontendToolDefinitions,
  hashBlockText,
  serverTools,
  type AgentState,
  type EditorHost,
} from '@margin/shared';
import { canUndo, isStale, parseProposal, resultFor, type Proposal } from './proposals';

/** What the panel shows about the current run. */
export type Activity =
  'idle' | 'reading' | 'writing' | 'proposing' | 'checking-a11y' | 'checking-seo';

/** A frontend tool call as the agent made it. */
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
  /** Every proposal in this conversation, oldest first. */
  proposals: readonly Proposal[];
  /** Pending body proposals whose block changed since they were made. */
  outdated: ReadonlySet<string>;
}

export interface AgentSessionOptions {
  host: EditorHost;
  /** Base URL of the agent server. */
  agentUrl: string;
  /** For tests: supply any AG-UI agent instead of the HTTP one. */
  createAgent?: (url: string) => AbstractAgent;
}

/** The server's own message from an HTTP error (the AG-UI client keeps the JSON body as `payload`). */
function serverMessage(error: unknown): string | undefined {
  const parsed = apiErrorSchema.safeParse((error as { payload?: unknown } | null)?.payload);
  return parsed.success ? parsed.data.error.message : undefined;
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
  let snapshot: SessionSnapshot = {
    messages: [],
    activity: 'idle',
    running: false,
    proposals: [],
    outdated: new Set(),
  };
  /** The current turn's tool calls, and the answers given so far (tool message content). */
  let batch: string[] = [];
  const answers = new Map<string, string>();
  let invalidStreak = 0;

  const update = (patch: Partial<SessionSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((l) => l());
  };

  const subscriber: AgentSubscriber = {
    onRunStartedEvent: () => update({ activity: 'reading' }),
    onTextMessageContentEvent: () => {
      if (snapshot.activity !== 'writing') update({ activity: 'writing' });
    },
    onToolCallStartEvent: ({ event }) =>
      update({
        activity:
          event.toolCallName === 'a11yCheck'
            ? 'checking-a11y'
            : event.toolCallName === 'seoCheck'
              ? 'checking-seo'
              : 'proposing',
      }),
    onToolCallEndEvent: ({ event, toolCallName, toolCallArgs }) => {
      // Server tools (checks) are answered by the server in the same run.
      if (toolCallName in serverTools) return;
      const call = { toolCallId: event.toolCallId, toolName: toolCallName, args: toolCallArgs };
      batch.push(call.toolCallId);
      const parsed = parseProposal(call, host);
      if (parsed.ok) {
        update({ proposals: [...snapshot.proposals, parsed.proposal] });
      } else {
        // Never shown as a card; the agent is told why and can try again.
        answers.set(
          call.toolCallId,
          JSON.stringify({ status: 'rejected', reason: `Invalid proposal: ${parsed.error}` }),
        );
      }
    },
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
        error:
          snapshot.error ??
          serverMessage(error) ??
          `The agent is not reachable: ${(error as Error).message}`,
      });
    } finally {
      update({ running: false, activity: 'idle', messages: [...agent.messages] });
    }
    await continueIfAnswered();
  }

  /** When every tool call of the turn has an answer, send them all in one new run. */
  async function continueIfAnswered(): Promise<void> {
    if (snapshot.running || batch.length === 0 || !batch.every((id) => answers.has(id))) return;
    const results = batch.map((toolCallId) => ({
      toolCallId,
      content: answers.get(toolCallId) ?? '',
    }));
    const allInvalid = batch.every((id) => !snapshot.proposals.some((p) => p.toolCallId === id));
    batch = [];
    answers.clear();
    invalidStreak = allInvalid ? invalidStreak + 1 : 0;
    if (invalidStreak > 2) {
      update({ error: 'The agent kept making proposals that could not be used. Try rephrasing.' });
      return;
    }
    await answer(results);
  }

  async function answer(results: { toolCallId: string; content: string }[]): Promise<void> {
    for (const r of results) {
      agent.addMessage({
        id: newId('tool'),
        role: 'tool',
        toolCallId: r.toolCallId,
        content: r.content,
      });
    }
    update({ messages: [...agent.messages] });
    await run();
  }

  function resolve(toolCallId: string, patch: Partial<Proposal>): Proposal | undefined {
    let resolved: Proposal | undefined;
    const proposals = snapshot.proposals.map((p) => {
      if (p.toolCallId !== toolCallId) return p;
      resolved = { ...p, ...patch } as Proposal;
      return resolved;
    });
    if (!resolved) return undefined;
    answers.set(toolCallId, JSON.stringify(resultFor(resolved)));
    update({ proposals, outdated: outdatedSet(proposals) });
    return resolved;
  }

  function outdatedSet(proposals: readonly Proposal[]): ReadonlySet<string> {
    const state = host.getState();
    return new Set(
      proposals.filter((p) => p.status === 'pending' && isStale(p, state)).map((p) => p.toolCallId),
    );
  }

  const pendingProposal = (toolCallId: string) =>
    snapshot.proposals.find((p) => p.toolCallId === toolCallId && p.status === 'pending');

  const unsubscribeHost = host.subscribe(() => {
    const outdated = outdatedSet(snapshot.proposals);
    if (
      outdated.size !== snapshot.outdated.size ||
      [...outdated].some((id) => !snapshot.outdated.has(id))
    ) {
      update({ outdated });
    }
  });

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
    /** Applies a proposal through the host. A changed block makes it stale instead. */
    async accept(toolCallId: string): Promise<void> {
      const proposal = pendingProposal(toolCallId);
      if (!proposal) return;
      if (isStale(proposal, host.getState())) {
        resolve(toolCallId, { status: 'stale' });
      } else {
        try {
          if (proposal.kind === 'field') {
            await host.applyFieldValue(proposal.field, proposal.after);
            resolve(toolCallId, {
              status: 'accepted',
              applied: host.getState().fields[proposal.field],
            });
          } else {
            await host.applyBodyEdit(proposal.blockId, proposal.after);
            const block = host.getState().body.find((b) => b.blockId === proposal.blockId);
            resolve(toolCallId, {
              status: 'accepted',
              appliedHash: block ? hashBlockText(block.text) : undefined,
            });
          }
        } catch (error) {
          resolve(toolCallId, {
            status: 'rejected',
            rejectReason: `Could not apply: ${(error as Error).message}`,
          });
        }
      }
      await continueIfAnswered();
    },
    /** Rejects a proposal; the optional reason goes back to the agent. A stale one is dismissed. */
    async reject(toolCallId: string, reason?: string): Promise<void> {
      const proposal = pendingProposal(toolCallId);
      if (!proposal) return;
      if (snapshot.outdated.has(toolCallId)) resolve(toolCallId, { status: 'stale' });
      else resolve(toolCallId, { status: 'rejected', rejectReason: reason?.trim() || undefined });
      await continueIfAnswered();
    },
    /**
     * Batch review (SPEC feature 10): answers every pending proposal the same way. Each one
     * goes through accept/reject, so outdated ones become stale and the run continues once.
     */
    async acceptAll(): Promise<void> {
      const ids = snapshot.proposals.filter((p) => p.status === 'pending').map((p) => p.toolCallId);
      for (const id of ids) await this.accept(id);
    },
    async rejectAll(): Promise<void> {
      const ids = snapshot.proposals.filter((p) => p.status === 'pending').map((p) => p.toolCallId);
      for (const id of ids) await this.reject(id);
    },
    /**
     * Restores what an accepted proposal replaced, if nothing changed it since (SPEC feature 9).
     * Local to the editor: the agent sees the restored value in the next run's state.
     */
    async undo(toolCallId: string): Promise<void> {
      const proposal = snapshot.proposals.find(
        (p) => p.toolCallId === toolCallId && p.status === 'accepted',
      );
      if (!proposal) return;
      const patch = (p: Partial<Proposal>) =>
        update({
          proposals: snapshot.proposals.map((x) =>
            x.toolCallId === toolCallId ? ({ ...x, ...p } as Proposal) : x,
          ),
        });
      if (!canUndo(proposal, host.getState())) {
        patch({ undoError: 'It changed after you accepted it, so it can no longer be undone.' });
        return;
      }
      try {
        if (proposal.kind === 'field') await host.applyFieldValue(proposal.field, proposal.before);
        else {
          await host.applyBodyEdit(proposal.blockId, {
            type: proposal.blockType,
            text: proposal.before,
            ...(proposal.beforeAttrs ? { attrs: proposal.beforeAttrs } : {}),
          });
        }
        patch({ status: 'undone', undoError: undefined });
      } catch (error) {
        patch({ undoError: `Could not undo: ${(error as Error).message}` });
      }
    },
    stop: () => agent.abortRun(),
    dispose: () => unsubscribeHost(),
  };
}

export type AgentSession = ReturnType<typeof createAgentSession>;
