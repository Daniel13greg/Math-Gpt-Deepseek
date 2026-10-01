import { translate, translatePlural, type LanguageCode } from '@/i18n/strings';

/**
 * Spaced repetition for flashcards: a compact SM-2 variant with the two answers the
 * flashcard screen offers ("Still learning" = again, "Got it" = good).
 */

export interface CardSchedule {
  /** Growth factor for the interval after each successful review (SM-2 "easiness"). */
  ease: number;
  /** Days until the next review after the last successful one (0 while relearning). */
  intervalDays: number;
  /** Successful reviews in a row. */
  reps: number;
  lapses: number;
  /** Timestamp (ms) when the card is next due. */
  due: number;
  lastReviewed: number;
}

export type Grade = 'again' | 'good';

const DAY = 24 * 60 * 60 * 1000;
const RELEARN_MS = 10 * 60 * 1000;
export const START_EASE = 2.5;
const MIN_EASE = 1.3;

export function schedule(prev: CardSchedule | undefined, grade: Grade, now = Date.now()): CardSchedule {
  const card = prev ?? { ease: START_EASE, intervalDays: 0, reps: 0, lapses: 0, due: now, lastReviewed: now };
  if (grade === 'again') {
    return {
      ease: Math.max(MIN_EASE, card.ease - 0.2),
      intervalDays: 0,
      reps: 0,
      lapses: card.lapses + (prev && prev.reps > 0 ? 1 : 0),
      due: now + RELEARN_MS,
      lastReviewed: now,
    };
  }
  const reps = card.reps + 1;
  const intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.max(card.intervalDays + 1, Math.round(card.intervalDays * card.ease));
  return { ease: card.ease, intervalDays, reps, lapses: card.lapses, due: now + intervalDays * DAY, lastReviewed: now };
}

/** End of the local day containing `now`: cards due by then count as "due today". */
export function endOfDay(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function isDue(card: CardSchedule | undefined, now = Date.now()): boolean {
  return !!card && card.due <= endOfDay(now);
}

/** "today", "tomorrow", "in 3 days", "in 2 weeks", "in 4 months". */
export function describeDue(due: number, lang: LanguageCode = 'en', now = Date.now()): string {
  if (due <= endOfDay(now)) return translate(lang, 'due.today');
  const days = Math.round((endOfDay(due) - endOfDay(now)) / DAY);
  if (days === 1) return translate(lang, 'due.tomorrow');
  if (days < 14) return translatePlural(lang, 'due.days', days);
  if (days < 60) return translatePlural(lang, 'due.weeks', Math.round(days / 7));
  return translatePlural(lang, 'due.months', Math.round(days / 30));
}
