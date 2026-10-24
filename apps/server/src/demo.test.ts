import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from './db/client';
import {
  createDailyCounter,
  initialResetDay,
  resetToSeed,
  scheduleNightlyReset,
  shouldReset,
} from './demo';
import { createDocumentRepository } from './documents/repository';
import { SEED_DOCUMENT_ID, seedIfEmpty } from './documents/seed';

describe('daily run counter', () => {
  it('allows up to the limit per UTC day, then starts again the next day', () => {
    let now = new Date('2026-10-22T23:59:00Z');
    const counter = createDailyCounter(2, () => now);
    expect([counter.take(), counter.take(), counter.take()]).toEqual([true, true, false]);
    now = new Date('2026-10-23T00:00:01Z');
    expect(counter.take()).toBe(true);
  });
});

describe('nightly reset', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once per day at or after the hour', () => {
    expect(shouldReset(new Date('2026-10-23T02:59:00Z'), '2026-10-22', 3)).toBe(false);
    expect(shouldReset(new Date('2026-10-23T03:05:00Z'), '2026-10-22', 3)).toBe(true);
    expect(shouldReset(new Date('2026-10-23T09:00:00Z'), '2026-10-23', 3)).toBe(false);
  });

  it('counts a start after the hour as reset, but not a start before it', () => {
    expect(initialResetDay(new Date('2026-10-23T11:00:00Z'), 10)).toBe('2026-10-23');
    expect(initialResetDay(new Date('2026-10-23T00:42:00Z'), 10)).toBe('');
  });

  it('still resets on the day the server started before the hour', () => {
    vi.useFakeTimers();
    let now = new Date('2026-10-23T00:42:00Z');
    const db = openDb(':memory:');
    const repo = createDocumentRepository(db);
    seedIfEmpty(repo);
    repo.create({ title: 'Visitor draft' });
    let resets = 0;
    const stop = scheduleNightlyReset(
      repo,
      10,
      () => (resets += 1),
      () => now,
    );
    now = new Date('2026-10-23T10:05:00Z');
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(resets).toBe(1);
    expect(repo.list().map((d) => d.title)).toEqual(['Writing for the web']);
    now = new Date('2026-10-23T10:15:00Z');
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(resets).toBe(1);
    stop();
    db.close();
  });

  it('puts the database back to just the seeded article', () => {
    const db = openDb(':memory:');
    const repo = createDocumentRepository(db);
    seedIfEmpty(repo);
    repo.create({ title: 'Visitor draft' });
    const seed = repo.get(SEED_DOCUMENT_ID);
    if (!seed) throw new Error('seed missing');
    repo.update(SEED_DOCUMENT_ID, { ...seed, title: 'Vandalised' });
    resetToSeed(repo);
    expect(repo.list().map((d) => d.title)).toEqual(['Writing for the web']);
    db.close();
  });
});
