import { diffWords } from '@margin/shared';
import { useId, useState } from 'react';
import { fieldValueText, type Proposal, type ProposalStatus } from './proposals';

interface ProposalCardProps {
  proposal: Proposal;
  outdated: boolean;
  onAccept: () => void;
  onReject: (reason: string) => void;
}

const STATUS_TEXT: Record<Exclude<ProposalStatus, 'pending'>, string> = {
  accepted: 'Accepted. Save the document to keep it.',
  rejected: 'Rejected.',
  stale: 'Not applied: the block changed.',
};

function titleOf(p: Proposal): string {
  if (p.kind === 'field') return p.label;
  return p.blockType === 'heading' ? 'Heading edit' : 'Body edit';
}

function Diff({ before, after }: { before: string; after: string }) {
  return (
    <p className="margin-proposal__diff">
      {diffWords(before, after).map((part, i) =>
        part.kind === 'same' ? (
          <span key={i}>{part.text}</span>
        ) : part.kind === 'removed' ? (
          <del key={i}>
            <span className="margin-sr">removed: </span>
            {part.text}
          </del>
        ) : (
          <ins key={i}>
            <span className="margin-sr">added: </span>
            {part.text}
          </ins>
        ),
      )}
    </p>
  );
}

/** One proposal: old vs new, the agent's reason, and Accept / Reject. */
export function ProposalCard({ proposal, outdated, onAccept, onReject }: ProposalCardProps) {
  const titleId = useId();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const title = titleOf(proposal);
  const before = proposal.kind === 'field' ? fieldValueText(proposal.before) : proposal.before;
  const after = proposal.kind === 'field' ? fieldValueText(proposal.after) : proposal.after.text;
  const pending = proposal.status === 'pending';

  return (
    <article
      className={`margin-proposal margin-proposal--${proposal.status}`}
      aria-labelledby={titleId}
      data-proposal={proposal.toolCallId}
    >
      <h3 id={titleId} className="margin-proposal__title">
        {title}
      </h3>
      <p className="margin-proposal__reason">{proposal.reason}</p>
      <Diff before={before} after={after} />
      {pending && outdated && (
        <p className="margin-proposal__warning" role="alert">
          This block changed after the proposal was made, so it can no longer be applied.
        </p>
      )}
      {pending ? (
        <div className="margin-proposal__actions">
          {!outdated && (
            <label className="margin-proposal__reason-label" htmlFor={reasonId}>
              Reason for rejecting (optional)
              <input
                id={reasonId}
                className="margin-panel__input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="margin-proposal__buttons">
            {!outdated && (
              <button
                type="button"
                className="margin-panel__button"
                data-action="accept"
                onClick={onAccept}
              >
                Accept<span className="margin-sr"> {title}</span>
              </button>
            )}
            <button
              type="button"
              className="margin-panel__button"
              data-action="reject"
              onClick={() => onReject(reason)}
            >
              {outdated ? 'Dismiss' : 'Reject'}
              <span className="margin-sr"> {title}</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="margin-proposal__status">
          {proposal.status === 'rejected' && proposal.rejectReason?.startsWith('Could not apply')
            ? proposal.rejectReason
            : STATUS_TEXT[proposal.status as Exclude<ProposalStatus, 'pending'>]}
        </p>
      )}
    </article>
  );
}
