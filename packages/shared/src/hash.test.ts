import { describe, expect, it } from 'vitest';
import { hashBlockText } from './hash';

describe('hashBlockText', () => {
  it('is stable for the same text', () => {
    expect(hashBlockText('Hello world')).toBe(hashBlockText('Hello world'));
  });

  it('changes when the text changes', () => {
    expect(hashBlockText('Hello world')).not.toBe(hashBlockText('Hello world!'));
  });

  it('returns 8 hex characters', () => {
    expect(hashBlockText('')).toMatch(/^[0-9a-f]{8}$/);
  });
});
