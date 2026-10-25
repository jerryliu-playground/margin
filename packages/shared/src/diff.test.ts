import { describe, expect, it } from 'vitest';
import { diffWords, type DiffPart } from './diff';

const join = (parts: DiffPart[], skip: DiffPart['kind']) =>
  parts
    .filter((p) => p.kind !== skip)
    .map((p) => p.text)
    .join('');

describe('diffWords', () => {
  it('marks a replaced word', () => {
    expect(diffWords('The quick fox', 'The slow fox')).toEqual([
      { kind: 'same', text: 'The ' },
      { kind: 'removed', text: 'quick' },
      { kind: 'added', text: 'slow' },
      { kind: 'same', text: ' fox' },
    ]);
  });

  it('rebuilds both sides exactly', () => {
    const before = 'One two  three.\nFour';
    const after = 'One three, four.\nFive';
    const parts = diffWords(before, after);
    expect(join(parts, 'added')).toBe(before);
    expect(join(parts, 'removed')).toBe(after);
  });

  it('keeps a word that only gained punctuation after it', () => {
    expect(diffWords('writing', 'writing, web, style')).toEqual([
      { kind: 'same', text: 'writing' },
      { kind: 'added', text: ', web, style' },
    ]);
  });

  it('keeps hyphens and apostrophes inside words', () => {
    expect(diffWords("don't re-read", "don't reread")).toEqual([
      { kind: 'same', text: "don't " },
      { kind: 'removed', text: 're-read' },
      { kind: 'added', text: 'reread' },
    ]);
  });

  it('handles empty sides', () => {
    expect(diffWords('', 'New text')).toEqual([{ kind: 'added', text: 'New text' }]);
    expect(diffWords('Old', '')).toEqual([{ kind: 'removed', text: 'Old' }]);
    expect(diffWords('', '')).toEqual([]);
  });
});
