import { describe, expect, it } from 'vitest';
import { relativeTime } from './relative-time';

const now = new Date('2026-10-24T12:00:00Z');
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe('relativeTime', () => {
  it('says "just now" under a minute', () => {
    expect(relativeTime(ago(30), now)).toBe('just now');
  });

  it('uses the largest whole unit', () => {
    expect(relativeTime(ago(5 * 60), now)).toBe('5 minutes ago');
    expect(relativeTime(ago(3 * 3600), now)).toBe('3 hours ago');
    expect(relativeTime(ago(24 * 3600), now)).toBe('yesterday');
    expect(relativeTime(ago(2 * 24 * 3600), now)).toBe('2 days ago');
    expect(relativeTime(ago(15 * 24 * 3600), now)).toBe('2 weeks ago');
    expect(relativeTime(ago(400 * 24 * 3600), now)).toBe('last year');
  });
});
