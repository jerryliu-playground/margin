import type { DocumentRepository } from './documents/repository';
import { seedIfEmpty } from './documents/seed';

/**
 * Protection for the public demo (ADR 0009): a global daily cap on agent runs, so a
 * public link cannot run up the model bill, and a nightly reset to the seeded article.
 */
export function createDailyCounter(limit: number, now: () => Date = () => new Date()) {
  let day = '';
  let used = 0;
  const today = () => now().toISOString().slice(0, 10); // UTC date
  return {
    /** Counts one run; false once today's limit is reached. */
    take(): boolean {
      if (today() !== day) {
        day = today();
        used = 0;
      }
      if (used >= limit) return false;
      used += 1;
      return true;
    },
  };
}

/** True once per UTC day, at the first check during or after `hour`. */
export function shouldReset(now: Date, lastResetDay: string, hour: number): boolean {
  const day = now.toISOString().slice(0, 10);
  return day !== lastResetDay && now.getUTCHours() >= hour;
}

export function resetToSeed(repo: DocumentRepository): void {
  repo.deleteAll();
  seedIfEmpty(repo);
}

/**
 * The day to treat as already reset when the server starts. Starting up resets nothing
 * (the volume keeps visitors' documents), so a start before the hour leaves today's reset due.
 */
export function initialResetDay(now: Date, hour: number): string {
  return now.getUTCHours() >= hour ? now.toISOString().slice(0, 10) : '';
}

/** Checks every 10 minutes; returns a stop function for app shutdown. */
export function scheduleNightlyReset(
  repo: DocumentRepository,
  hour: number,
  onReset: () => void,
  now: () => Date = () => new Date(),
): () => void {
  let lastResetDay = initialResetDay(now(), hour);
  const timer = setInterval(
    () => {
      if (!shouldReset(now(), lastResetDay, hour)) return;
      lastResetDay = now().toISOString().slice(0, 10);
      resetToSeed(repo);
      onReset();
    },
    10 * 60 * 1000,
  );
  timer.unref();
  return () => clearInterval(timer);
}
