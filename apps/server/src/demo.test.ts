import { describe, expect, it } from 'vitest';
import { openDb } from './db/client';
import { createDailyCounter, resetToSeed, shouldReset } from './demo';
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
  it('fires once per day at or after the hour', () => {
    expect(shouldReset(new Date('2026-10-23T02:59:00Z'), '2026-10-22', 3)).toBe(false);
    expect(shouldReset(new Date('2026-10-23T03:05:00Z'), '2026-10-22', 3)).toBe(true);
    expect(shouldReset(new Date('2026-10-23T09:00:00Z'), '2026-10-23', 3)).toBe(false);
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
