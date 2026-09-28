import { DAY_MS } from "@/lib/date";
import type { MasteryStatus, Rating, WordProgress } from "@/lib/types";

/**
 * Spaced repetition, SM-2 flavoured.
 *
 * Deliberately invisible: the user is told "today's 25 words" and never sees
 * an interval, an ease factor or a due date. The complexity lives here.
 */

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const START_EASE = 2.5;

/** Interval multipliers per rating, applied on top of the ease factor. */
const INTERVAL_FACTOR: Record<Rating, number> = {
  hard: 0.45,
  good: 1,
  easy: 1.35,
};

/** Ease deltas. */
const EASE_DELTA: Record<Rating, number> = {
  hard: -0.22,
  good: 0.02,
  easy: 0.16,
};

/** Difficulty deltas — feeds the "needs attention" queue. */
const DIFFICULTY_DELTA: Record<Rating, number> = {
  hard: 0.22,
  good: -0.07,
  easy: -0.14,
};

/** First interval (in days) granted on a successful first recall. */
const FIRST_INTERVAL: Record<Rating, number> = {
  hard: 0.5,
  good: 1,
  easy: 3,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function createProgress(wordId: string, now: Date = new Date()): WordProgress {
  return {
    wordId,
    status: "new",
    repetitions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    ease: START_EASE,
    intervalDays: 0,
    difficulty: 0.5,
    lapses: 0,
    firstSeenAt: now.toISOString(),
  };
}

/**
 * Interval for the *next* review. Half-day steps are used for the first
 * couple of passes so a word marked "Hard" genuinely returns within the same
 * day rather than tomorrow — that is what makes the review queue feel alive.
 */
function nextInterval(prev: WordProgress, rating: Rating, repeatsAfter: number): number {
  if (repeatsAfter <= 1) return FIRST_INTERVAL[rating];
  const base = Math.max(prev.intervalDays, 1);
  const raw = base * prev.ease * INTERVAL_FACTOR[rating];
  // Jitter of ±8% so words introduced together do not clump forever.
  const jitter = 0.92 + ((prev.repetitions * 37) % 17) / 100;
  return clamp(raw * jitter, 0.5, 365);
}

export function applyRating(
  prev: WordProgress | undefined,
  wordId: string,
  rating: Rating,
  now: Date = new Date(),
): WordProgress {
  const base = prev ?? createProgress(wordId, now);

  const correct = rating !== "hard";
  const repetitions = correct ? base.repetitions + 1 : base.repetitions;
  const ease = clamp(base.ease + EASE_DELTA[rating], MIN_EASE, MAX_EASE);
  const difficulty = clamp(base.difficulty + DIFFICULTY_DELTA[rating], 0, 1);
  const intervalDays = nextInterval({ ...base, ease }, rating, repetitions);

  const next: WordProgress = {
    ...base,
    repetitions,
    ease,
    difficulty,
    intervalDays,
    correctAnswers: base.correctAnswers + (correct ? 1 : 0),
    incorrectAnswers: base.incorrectAnswers + (correct ? 0 : 1),
    lapses: base.lapses + (rating === "hard" && base.repetitions > 0 ? 1 : 0),
    lastReviewedAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
  };

  next.status = deriveStatus(next);
  return next;
}

export function deriveStatus(p: WordProgress): MasteryStatus {
  if (p.repetitions === 0) return "new";
  if (p.repetitions <= 2) return "learning";
  if (p.repetitions <= 4) return "familiar";
  return p.ease >= 2.4 && p.difficulty < 0.35 ? "mastered" : "familiar";
}

export function isDue(p: WordProgress, now: Date = new Date()): boolean {
  if (p.status === "new") return false;
  if (!p.nextReviewAt) return true;
  return new Date(p.nextReviewAt).getTime() <= now.getTime();
}

/** How overdue, normalised. Drives review-queue ordering. */
export function overduePressure(p: WordProgress, now: Date = new Date()): number {
  if (!p.nextReviewAt) return 1;
  const overdueDays = (now.getTime() - new Date(p.nextReviewAt).getTime()) / DAY_MS;
  return clamp(overdueDays / 14, 0, 1);
}

export const MASTERY_LADDER: MasteryStatus[] = ["new", "learning", "familiar", "mastered"];

export function statusLabel(status: MasteryStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "learning":
      return "Learning";
    case "familiar":
      return "Familiar";
    case "mastered":
      return "Mastered";
  }
}
