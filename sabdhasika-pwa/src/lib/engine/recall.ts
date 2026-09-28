import { getVocabulary } from "@/lib/data";
import { DAY_MS } from "@/lib/date";
import type { AppState, RecallEntry, VocabularyWord, WordProgress } from "@/lib/types";
import { isDue, overduePressure } from "./scheduler";

/**
 * The Recall drill.
 *
 * A flashcard session tests *recognition* — you see the word and recognise
 * its meaning. That is the easy direction, and on its own it produces
 * learners who can read but not speak. Recall tests the other direction:
 * you are given the meaning and must produce the word.
 *
 * Everything here is about *choosing well*, because the drill is only worth
 * doing if it targets the words that are genuinely at risk of slipping. The
 * selection is deliberately boring and explainable: weakness, overdue-ness
 * and lapses, with a penalty for anything just tested.
 *
 * Attempts are fed straight back into the spaced-repetition scheduler, so a
 * drill is real study rather than a side game with its own little score.
 */

/** How many cards a drill contains by default. */
export const RECALL_DECK_SIZE = 10;

/** Do not re-test a word within this window — a drill is not a treadmill. */
const COOLDOWN_MS = 6 * 60 * 60 * 1000;

export interface RecallCard {
  word: VocabularyWord;
  /** A short, honest reason this word is in the deck. */
  reason: string;
}

export interface RecallDeck {
  cards: RecallCard[];
  /** True when the pool was too thin and we fell back to whatever exists. */
  thin: boolean;
}

/* ------------------------------------------------------------------ *
 * Selection
 * ------------------------------------------------------------------ */

function lastRecallAt(log: RecallEntry[], wordId: string): number {
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].wordId === wordId) return new Date(log[i].at).getTime();
  }
  return 0;
}

/**
 * How much this word needs a recall attempt, 0..1.
 *
 * Weighted towards `difficulty` because that is the only signal the learner
 * themselves produced — everything else is a proxy. Recency of the last
 * review enters negatively: a word you met an hour ago is not yet at risk,
 * and testing it now would only measure short-term memory.
 */
export function recallPressure(p: WordProgress, now: Date = new Date()): number {
  const lapseScore = Math.min(1, p.lapses / 3);
  const fragile = 1 - Math.min(1, p.repetitions / 6);

  let staleness = 0.5;
  if (p.lastReviewedAt) {
    const days = (now.getTime() - new Date(p.lastReviewedAt).getTime()) / DAY_MS;
    staleness = Math.min(1, days / 14);
  }

  const score =
    p.difficulty * 0.42 +
    overduePressure(p, now) * 0.24 +
    lapseScore * 0.16 +
    fragile * 0.1 +
    staleness * 0.08;

  return Math.min(1, Math.max(0, score));
}

function reasonFor(p: WordProgress, now: Date): string {
  if (p.lapses >= 2) return `Slipped ${p.lapses} times`;
  if (p.difficulty >= 0.62) return "You rated this hard";
  if (isDue(p, now)) return "Due for review";
  if (p.status === "learning") return "Still settling in";
  if (!p.lastReviewedAt) return "Only met once";
  const days = Math.floor((now.getTime() - new Date(p.lastReviewedAt).getTime()) / DAY_MS);
  if (days >= 7) return `Not seen in ${days} days`;
  return "Keeping it sharp";
}

/**
 * Build a drill.
 *
 * Words the learner has never met are excluded outright: you cannot recall
 * something you have never been shown, and a drill full of unknown words
 * teaches nothing except that the app is unfair.
 */
export function buildRecallDeck(
  state: AppState,
  now: Date = new Date(),
  size: number = RECALL_DECK_SIZE,
): RecallDeck {
  const vocab = getVocabulary(state.settings.targetLanguage);
  const progress = state.progress;
  const log = state.recallLog ?? [];

  const known = vocab.filter((w) => {
    const p = progress[w.id];
    return p && p.status !== "new";
  });

  const cooled = known.filter((w) => now.getTime() - lastRecallAt(log, w.id) >= COOLDOWN_MS);

  // Fall back to the full known pool when the cooldown would starve the drill
  // — better to re-test than to show an empty screen.
  const thin = cooled.length < Math.min(4, size);
  const pool = thin ? known : cooled;

  const cards = pool
    .map((word) => ({ word, p: progress[word.id] }))
    .sort(
      (a, b) =>
        recallPressure(b.p, now) - recallPressure(a.p, now) ||
        a.word.frequencyRank - b.word.frequencyRank,
    )
    .slice(0, size)
    .map(({ word, p }) => ({ word, reason: reasonFor(p, now) }));

  return { cards, thin };
}

/* ------------------------------------------------------------------ *
 * Prompt construction
 * ------------------------------------------------------------------ */

/**
 * Hide the target word inside its own example sentence, so the example
 * becomes a clue instead of the answer. Returns null when the sentence does
 * not actually contain the word (conjugated forms, for instance) — a blank
 * in the wrong place is worse than no example at all.
 */
export function blankOut(sentence: string, word: string): string | null {
  if (!sentence || !word) return null;
  const at = sentence.indexOf(word);
  if (at === -1) return null;
  return `${sentence.slice(0, at)}____${sentence.slice(at + word.length)}`;
}

/* ------------------------------------------------------------------ *
 * Strength
 * ------------------------------------------------------------------ */

export interface RecallStrength {
  remembered: number;
  total: number;
  /** remembered / total, or null before the first attempt. */
  rate: number | null;
  /** Attempts counted, so the UI can say "over the last N". */
  window: number;
}

const STRENGTH_WINDOW = 40;

export function recallStrength(state: AppState): RecallStrength {
  const log = (state.recallLog ?? []).slice(-STRENGTH_WINDOW);
  const remembered = log.filter((e) => e.remembered).length;
  return {
    remembered,
    total: log.length,
    rate: log.length ? remembered / log.length : null,
    window: log.length,
  };
}

/** How many words are eligible for a drill right now — for the entry point. */
export function recallReadyCount(state: AppState, now: Date = new Date()): number {
  return buildRecallDeck(state, now).cards.length;
}

export function recallEntriesOn(state: AppState, date: string): number {
  return (state.recallLog ?? []).filter((e) => e.date === date).length;
}
