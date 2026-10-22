import { hashBlockText } from '@margin/shared';
import { describe, expect, it } from 'vitest';
import { fakeHost } from './fake-agent';
import { isStale, parseProposal, resultFor, type Proposal } from './proposals';

const call = (toolName: string, args: Record<string, unknown>) => ({
  toolCallId: 'c1',
  toolName,
  args,
});

describe('parseProposal', () => {
  it('builds a field proposal with the current value as "before"', () => {
    const res = parseProposal(
      call('proposeFieldValue', { field: 'title', value: 'Hi', reason: 'Shorter.' }),
      fakeHost(),
    );
    expect(res).toEqual({
      ok: true,
      proposal: expect.objectContaining({
        kind: 'field',
        label: 'Title',
        before: 'Hello',
        after: 'Hi',
      }),
    });
  });

  it('builds a body proposal with a base hash', () => {
    const res = parseProposal(
      call('proposeBodyEdit', {
        blockId: 'p1',
        newContent: { type: 'paragraph', text: 'Short.' },
        reason: 'Tighter.',
      }),
      fakeHost(),
    );
    expect(res.ok && res.proposal).toMatchObject({
      kind: 'body',
      before: 'One long sentence here.',
      baseHash: hashBlockText('One long sentence here.'),
    });
  });

  it('refuses bad arguments, unknown fields, wrong kinds, over-long values and unknown blocks', () => {
    const host = fakeHost();
    const errors = [
      call('proposeFieldValue', { field: 'title', value: 'Hi' }),
      call('proposeFieldValue', { field: 'slug', value: 'x', reason: 'r' }),
      call('proposeFieldValue', { field: 'title', value: ['x'], reason: 'r' }),
      call('proposeFieldValue', { field: 'title', value: 'x'.repeat(21), reason: 'r' }),
      call('proposeBodyEdit', {
        blockId: 'nope',
        newContent: { type: 'paragraph', text: 'x' },
        reason: 'r',
      }),
      call('deleteEverything', {}),
    ].map((c) => parseProposal(c, host));
    expect(errors.every((r) => !r.ok)).toBe(true);
    expect(errors.map((r) => (r.ok ? '' : r.error))).toEqual([
      expect.stringContaining('reason'),
      'Unknown field "slug".',
      'Field "title" expects text.',
      'Field "title" allows at most 20 characters.',
      'No block with id "nope".',
      'Unknown tool "deleteEverything".',
    ]);
  });
});

describe('the smoke-test case: a 175-character meta description', () => {
  it('is refused before a card is shown when the host allows 160', () => {
    const host = fakeHost();
    const schema = host
      .getSchema()
      .map((f) => (f.name === 'metaDescription' ? { ...f, maxLength: 160 } : f));
    host.getSchema = () => schema;
    const res = parseProposal(
      call('proposeFieldValue', { field: 'metaDescription', value: 'x'.repeat(175), reason: 'r' }),
      host,
    );
    expect(res).toEqual({
      ok: false,
      error: 'Field "metaDescription" allows at most 160 characters.',
    });
  });
});

describe('isStale and resultFor', () => {
  it('detects a changed block', () => {
    const host = fakeHost();
    const res = parseProposal(
      call('proposeBodyEdit', {
        blockId: 'p1',
        newContent: { type: 'paragraph', text: 'x' },
        reason: 'r',
      }),
      host,
    );
    if (!res.ok) throw new Error(res.error);
    expect(isStale(res.proposal, host.getState())).toBe(false);
    host.editBlock('p1', 'Edited by hand.');
    expect(isStale(res.proposal, host.getState())).toBe(true);
  });

  it('maps statuses to tool results', () => {
    const base = {
      kind: 'field',
      toolCallId: 'c',
      field: 'title',
      label: 'T',
      before: '',
      after: '',
      reason: 'r',
    } as const;
    const with_ = (p: Partial<Proposal>) =>
      resultFor({ ...base, status: 'pending', ...p } as Proposal);
    expect(with_({ status: 'accepted' })).toEqual({ status: 'accepted' });
    expect(with_({ status: 'rejected', rejectReason: 'No' })).toEqual({
      status: 'rejected',
      reason: 'No',
    });
    expect(with_({ status: 'rejected' })).toEqual({ status: 'rejected' });
    expect(with_({ status: 'stale' })).toEqual({ status: 'stale' });
  });
});
