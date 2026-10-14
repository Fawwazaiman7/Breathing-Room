import { NASA_TLX_DIMENSIONS, NASA_TLX_PAIRS, OLBI_STATEMENTS } from './content';
import type { NasaTlxDimension } from './types';

/**
 * Unfinished screening answers, kept in the browser so that a student who
 * switches apps on a phone (and whose browser reloads the page when they
 * come back) continues where they stopped instead of starting again.
 *
 * Stored per account and only on this device. Removed after submitting,
 * and ignored once it is older than a day.
 */
export interface ScreeningDraft {
  stepIndex: number;
  choices: (NasaTlxDimension | null)[];
  ratings: (number | null)[];
  answers: (number | null)[];
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const keyFor = (userId: string) => `breathing-room:screening-draft:${userId}`;

function isListOf<T>(
  value: unknown,
  length: number,
  check: (item: unknown) => item is T,
): value is (T | null)[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => item === null || check(item))
  );
}

const isDimension = (item: unknown): item is NasaTlxDimension =>
  typeof item === 'string' &&
  (NASA_TLX_DIMENSIONS as string[]).includes(item);
const isRating = (item: unknown): item is number =>
  typeof item === 'number' && item >= 0 && item <= 100;
const isAnswer = (item: unknown): item is number =>
  item === 1 || item === 2 || item === 3 || item === 4;

export function loadDraft(userId: string, stepCount: number): ScreeningDraft | null {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) {
      return null;
    }
    const saved = JSON.parse(raw) as Partial<ScreeningDraft> & { savedAt?: number };
    const fresh =
      typeof saved.savedAt === 'number' && Date.now() - saved.savedAt < MAX_AGE_MS;
    const valid =
      Number.isInteger(saved.stepIndex) &&
      (saved.stepIndex as number) > 0 &&
      (saved.stepIndex as number) < stepCount &&
      isListOf(saved.choices, NASA_TLX_PAIRS.length, isDimension) &&
      isListOf(saved.ratings, NASA_TLX_DIMENSIONS.length, isRating) &&
      isListOf(saved.answers, OLBI_STATEMENTS.length, isAnswer);
    if (!fresh || !valid) {
      window.localStorage.removeItem(keyFor(userId));
      return null;
    }
    return {
      stepIndex: saved.stepIndex as number,
      choices: saved.choices as (NasaTlxDimension | null)[],
      ratings: saved.ratings as (number | null)[],
      answers: saved.answers as (number | null)[],
    };
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, draft: ScreeningDraft): void {
  try {
    window.localStorage.setItem(
      keyFor(userId),
      JSON.stringify({ ...draft, savedAt: Date.now() }),
    );
  } catch {
    // Storage can be unavailable (private mode, full); the screening still works.
  }
}

export function clearDraft(userId: string): void {
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    // Nothing to clear.
  }
}
