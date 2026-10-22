import type { Message } from '@ag-ui/client';
import type { EditorHost } from '@margin/shared';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Activity, AgentSession } from './agent-session';
import { CHECK_TITLE, checkEntries, type CheckEntry } from './checks';
import { ProposalCard } from './ProposalCard';
import { useAgentSession } from './useAgentSession';

export interface AgentPanelProps {
  host: EditorHost;
  /** Base URL of the agent server, e.g. http://localhost:8790 */
  agentUrl: string;
}

const ACTIVITY_TEXT: Record<Activity, string> = {
  idle: '',
  reading: 'Reading document…',
  writing: 'Writing…',
  proposing: 'Proposing an edit…',
  'checking-a11y': 'Checking accessibility…',
  'checking-seo': 'Checking SEO…',
};

function CheckSummary({ entry }: { entry: CheckEntry }) {
  return (
    <div className="margin-panel__msg margin-panel__msg--check">
      <span className="margin-panel__who">{CHECK_TITLE[entry.toolName]}</span>
      <p>{entry.result.summary}</p>
      {entry.result.issues.length > 0 && (
        <ul className="margin-panel__issues">
          {entry.result.issues.map((issue, i) => (
            <li key={i}>
              <span className="margin-sr">{issue.severity}: </span>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function textOf(message: Message): string {
  return typeof message.content === 'string' ? message.content : '';
}

/** Host-agnostic agent side panel (SPEC §5). Talks to the editor only through EditorHost. */
export function AgentPanel({ host, agentUrl }: AgentPanelProps) {
  const headingId = useId();
  const inputId = useId();
  const [session, snapshot] = useAgentSession(host, agentUrl);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * After Accept/Reject, focus moves to the next pending proposal, or to the message box
   * when none is left (CLAUDE.md rule 6). Focus never leaves the panel.
   */
  const answer = (toolCallId: string, act: (s: AgentSession) => Promise<void>) => {
    const next = session
      .getSnapshot()
      .proposals.find((p) => p.status === 'pending' && p.toolCallId !== toolCallId);
    void act(session);
    requestAnimationFrame(() => {
      const target = next
        ? rootRef.current?.querySelector<HTMLButtonElement>(
            `[data-proposal="${CSS.escape(next.toolCallId)}"] button`,
          )
        : inputRef.current;
      target?.focus();
    });
  };

  const checks = checkEntries(snapshot.messages);
  // The status line is a live region: it tells screen reader users that cards arrived.
  const pendingCount = snapshot.proposals.filter((p) => p.status === 'pending').length;
  const pendingText =
    pendingCount === 0 ? '' : `${pendingCount} proposal${pendingCount > 1 ? 's' : ''} to review.`;
  const visible = snapshot.messages.filter(
    (m) => ((m.role === 'user' || m.role === 'assistant') && textOf(m) !== '') || checks.has(m.id),
  );

  const submit = () => {
    if (!draft.trim() || snapshot.running) return;
    void session.send(draft);
    setDraft('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <aside className="margin-panel" aria-labelledby={headingId} ref={rootRef}>
      <h2 id={headingId} className="margin-panel__title">
        Agent
      </h2>
      {/* role="log" is not allowed on <ol>, so the log is a div of message blocks. */}
      <div className="margin-panel__log" role="log" aria-label="Conversation" aria-live="polite">
        {visible.map((m) => {
          const check = checks.get(m.id);
          if (check) return <CheckSummary key={m.id} entry={check} />;
          return (
            <div key={m.id} className={`margin-panel__msg margin-panel__msg--${m.role}`}>
              <span className="margin-panel__who">{m.role === 'user' ? 'You' : 'Agent'}</span>
              <p>{textOf(m)}</p>
            </div>
          );
        })}
      </div>
      {snapshot.proposals.length > 0 && (
        <section className="margin-panel__proposals" aria-label="Proposals">
          {snapshot.proposals.map((p) => (
            <ProposalCard
              key={p.toolCallId}
              proposal={p}
              outdated={snapshot.outdated.has(p.toolCallId)}
              onAccept={() => answer(p.toolCallId, (s) => s.accept(p.toolCallId))}
              onReject={(reason) => answer(p.toolCallId, (s) => s.reject(p.toolCallId, reason))}
              onUndo={() => answer(p.toolCallId, (s) => s.undo(p.toolCallId))}
            />
          ))}
        </section>
      )}
      <p className="margin-panel__status" role="status">
        {ACTIVITY_TEXT[snapshot.activity] || pendingText}
      </p>
      {snapshot.error && (
        <p className="margin-panel__error" role="alert">
          {snapshot.error}
        </p>
      )}
      <form
        className="margin-panel__form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={inputId} className="margin-panel__label">
          Message the agent
        </label>
        <textarea
          id={inputId}
          ref={inputRef}
          className="margin-panel__input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="margin-panel__button" disabled={snapshot.running}>
          Send
        </button>
      </form>
    </aside>
  );
}
