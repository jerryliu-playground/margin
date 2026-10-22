import {
  hashBlockText,
  proposeBodyEditArgsSchema,
  proposeFieldValueArgsSchema,
  type BodyBlockContent,
  type DocumentState,
  type EditorHost,
  type FieldValue,
  type ProposalResult,
} from '@margin/shared';
import { z } from 'zod';
import type { ToolCallRequest } from './agent-session';

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'stale';

interface ProposalBase {
  toolCallId: string;
  reason: string;
  status: ProposalStatus;
  /** Why it was rejected (by the user, or because it could not be applied). */
  rejectReason?: string | undefined;
}
export interface FieldProposal extends ProposalBase {
  kind: 'field';
  field: string;
  label: string;
  before: FieldValue;
  after: FieldValue;
}
export interface BodyProposal extends ProposalBase {
  kind: 'body';
  blockId: string;
  blockType: string;
  before: string;
  after: BodyBlockContent;
  /** Hash of the block's text when proposed (ADR 0006). */
  baseHash: string;
}
export type Proposal = FieldProposal | BodyProposal;

export type ParseResult = { ok: true; proposal: Proposal } | { ok: false; error: string };

/** Turns a tool call into a proposal, validating it against the shared schema and the host. */
export function parseProposal(call: ToolCallRequest, host: EditorHost): ParseResult {
  const state = host.getState();
  if (call.toolName === 'proposeFieldValue') {
    const parsed = proposeFieldValueArgsSchema.safeParse(call.args);
    if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
    const { field, value, reason } = parsed.data;
    const descriptor = host.getSchema().find((f) => f.name === field);
    if (!descriptor) return { ok: false, error: `Unknown field "${field}".` };
    if ((descriptor.kind === 'tags') !== Array.isArray(value)) {
      return {
        ok: false,
        error: `Field "${field}" expects ${descriptor.kind === 'tags' ? 'a list of tags' : 'text'}.`,
      };
    }
    if (descriptor.maxLength && typeof value === 'string' && value.length > descriptor.maxLength) {
      return {
        ok: false,
        error: `Field "${field}" allows at most ${descriptor.maxLength} characters.`,
      };
    }
    return {
      ok: true,
      proposal: {
        kind: 'field',
        toolCallId: call.toolCallId,
        field,
        label: descriptor.label,
        before: state.fields[field] ?? (descriptor.kind === 'tags' ? [] : ''),
        after: value,
        reason,
        status: 'pending',
      },
    };
  }
  if (call.toolName === 'proposeBodyEdit') {
    const parsed = proposeBodyEditArgsSchema.safeParse(call.args);
    if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
    const { blockId, newContent, reason } = parsed.data;
    const block = state.body.find((b) => b.blockId === blockId);
    if (!block) return { ok: false, error: `No block with id "${blockId}".` };
    return {
      ok: true,
      proposal: {
        kind: 'body',
        toolCallId: call.toolCallId,
        blockId,
        blockType: block.type,
        before: block.text,
        after: newContent,
        baseHash: hashBlockText(block.text),
        reason,
        status: 'pending',
      },
    };
  }
  return { ok: false, error: `Unknown tool "${call.toolName}".` };
}

/** A body proposal is stale once its block changed or disappeared. */
export function isStale(proposal: Proposal, state: DocumentState): boolean {
  if (proposal.kind !== 'body') return false;
  const block = state.body.find((b) => b.blockId === proposal.blockId);
  return !block || hashBlockText(block.text) !== proposal.baseHash;
}

export function resultFor(proposal: Proposal): ProposalResult {
  switch (proposal.status) {
    case 'accepted':
      return { status: 'accepted' };
    case 'stale':
      return { status: 'stale' };
    default:
      return proposal.rejectReason
        ? { status: 'rejected', reason: proposal.rejectReason }
        : { status: 'rejected' };
  }
}

export const fieldValueText = (value: FieldValue) =>
  Array.isArray(value) ? value.join(', ') : value;
