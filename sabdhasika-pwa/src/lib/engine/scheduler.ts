import { DAY_MS } from "@/lib/date";
import type { MasteryStatus, Rating, WordProgress } from "@/lib/types";

/**
 * Spaced repetition, FSRS-5.
 *
 * Deliberately invisible: the user is told "today's 25 words" and never sees
 * an interval, a stability figure or a due date. The complexity lives here.
 *
 * This replaced an SM-2 implementation. SM-2 could only say "this word is due",
 * which is a boolean and not very useful — it cannot say *how close to being
 * forgotten* a word is, so the review queue had to fall back on blunt proxies
 * ("difficulty >= 0.6", "lapses >= 2") that lumped a word one day from slipping
 * together with one forgotten months ago.
 *
 * FSRS models memory as a decaying curve, so it can answer the question that
 * actually matters: *which words am I about to lose?* That is what the
 * "Slipping soon" bucket is built on.
 */

/** Desired retention: schedule each word so it holds at 90% at review time. */
const TARGET_RETENTION = 0.9;

/** Curve exponent. -0.5 is the FSRS-5 default. */
const DECAY = -0.5;

/** FACTOR = 0.9^(1/DECAY) - 1. Fixed by the curve shape, not tunable. */
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;

/**
 * FSRS-5 default weights, trained on the open review corpus.
 *
 * Kept as named constants rather than a bare array: index 4-7 are the
 * difficulty model and 8-18 the stability model, and the distinction matters
 * when a word is behaving oddly.
 */
const W = {
  /** Initial stability by rating (again / hard / good / easy). */
  initStability: [0.40255, 0.40255, 1.18385, 3.173],
  initStabilityEasy: 15.69105,
  /** D0(G) = w4 - e^(w5 * (G-1)) + 1 */
  diffBase: 7.1949,
  diffSlope: 0.5345,
  /** Linear difficulty damping and mean reversion. */
  diffDamping: 1.4604,
  diffReversion: 0.0046,
  /** Stability on a successful recall. */
  stRecallBase: 1.54575,
  stRecallExp: 0.1192,
  stRecallHardPenalty: 0.2315,
  stRecallEasyBonus: 2.9898,
} as const;

/*
 * FSRS-5 also defines stability-after-lapse weights, used by its `again`
 * grade. This app has no `again` — deferring a card is a queue move, not a
 * rating — so those weights have no caller and are deliberately not ported.
 */

/**
 * The app has three buttons, FSRS has four.
 *
 * `hard` here means "I got it, but it was hard" — a strained success, not a
 * failure. Deferring a card is the app's "I don't know this at all" move and is
 * not a rating at all (see `store.defer`). So there is no "again" and every
 * rating is a recall. Mapping hard to FSRS's Hard keeps the schedule honest:
 * stability still grows, just far less than for Good or Easy.
 */
const GRADE: Record<Rating, 2 | 3 | 4> = { hard: 2, good: 3, easy: 4 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Interval in days that leaves a word at exactly TARGET_RETENTION. */
function intervalForRetention(stability: number, now: Date, last: string | undefined): number {
  const elapsed = last
    ? Math.max(0, (now.getTime() - new Date(last).getTime()) / DAY_MS)
    : 0;
  const target = (stability / FACTOR) * (Math.pow(TARGET_RETENTION, 1 / DECAY) - 1);
  return clamp(Math.max(target, elapsed + 0.01), 0.5, 365);
}

/**
 * How likely the word is to be recalled right now, 0..1.
 *
 * Returns 1 for a word with no history and a word whose memory is fresh, so
 * callers can treat "not started" and "just reviewed" the same way.
 */
export function retrievability(p: WordProgress, now: Date = new Date()): number {
  if (p.status === "new" || p.repetitions === 0) return 1;
  if (p.stability === undefined || !p.lastReviewedAt) return 1;
  const elapsedDays = Math.max(0, (now.getTime() - new Date(p.lastReviewedAt).getTime()) / DAY_MS);
  return Math.pow(1 + (FACTOR * elapsedDays) / p.stability, DECAY);
}

/**
 * Initial stability for a word's first ever review.
 *
 * The first rating barely matters here — what matters is that a word rated
 * Hard comes back the same day and one rated Easy comes back in days, so the
 * very first interval is graded rather than uniform.
 */
function initialStability(grade: 2 | 3 | 4): number {
  const byGrade = W.initStability[grade - 1] ?? W.initStability[2];
  return grade === 4 ? W.initStabilityEasy : byGrade;
}

function initialDifficulty(grade: 2 | 3 | 4): number {
  return W.diffBase - Math.exp(W.diffSlope * (grade - 1)) + 1;
}

export function createProgress(wordId: string, now: Date = new Date()): WordProgress {
  return {
    wordId,
    status: "new",
    repetitions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    stability: 0,
    intervalDays: 0,
    difficulty: 0.5,
    lapses: 0,
    firstSeenAt: now.toISOString(),
  };
}

export function applyRating(
  prev: WordProgress | undefined,
  wordId: string,
  rating: Rating,
  now: Date = new Date(),
): WordProgress {
  const base = prev ?? createProgress(wordId, now);
  const grade = GRADE[rating];
  const stability = base.stability ?? 0;
  // FSRS works in D[1,10]; the stored field is D/10 on a 0..1 scale. These two
  // conversions must be exact inverses — an earlier version stored `d/10 - 0.1`
  // and read back `(d + 1) * 5`, which is not its inverse, so difficulty crept
  // upward on every review and an Easy-rated word ended up "harder" each time.
  const difficulty10 = (base.difficulty + 0.1) * 10;

  let nextStability: number;
  let nextDifficulty10: number;

  if (base.repetitions === 0 || stability <= 0) {
    // First look. The learner's self-assessment is the only signal there is.
    nextStability = initialStability(grade);
    nextDifficulty10 = initialDifficulty(grade);
  } else {
    const retrievabilityNow = retrievability(base, now);

    // Difficulty: move linearly away from "perfect", then pull back toward the
    // population mean so one bad day cannot permanently brand a word.
    const linear = clamp(difficulty10 - W.diffDamping * (grade - 3), 1, 10);
    nextDifficulty10 = W.diffReversion * initialDifficulty(4) + (1 - W.diffReversion) * linear;

    // Stability: grows by how much this recall exceeded expectations, which is
    // what makes an overdue word that is still recalled earn a big jump.
    const hardPenalty = grade === 2 ? W.stRecallHardPenalty : 1;
    const easyBonus = grade === 4 ? W.stRecallEasyBonus : 1;
    const growth =
      1 +
      Math.exp(W.stRecallBase) *
        (11 - difficulty10) *
        Math.pow(stability, -W.stRecallExp) *
        (Math.exp(W.stRecallExp * (1 - retrievabilityNow)) - 1) *
        hardPenalty *
        easyBonus;
    nextStability = clamp(stability * growth, 0.1, 36500);
  }

  const intervalDays = intervalForRetention(
    nextStability,
    now,
    base.repetitions === 0 ? undefined : base.lastReviewedAt,
  );

  const next: WordProgress = {
    ...base,
    repetitions: base.repetitions + 1,
    stability: nextStability,
    // Kept on a 0..1 scale because `recall.ts` and `stats.ts` both read it
    // directly and the review screen renders it as difficulty dots.
    difficulty: clamp(nextDifficulty10 / 10 - 0.1, 0, 1),
    intervalDays,
    correctAnswers: base.correctAnswers + 1,
    incorrectAnswers: base.incorrectAnswers + (rating === "hard" ? 1 : 0),
    lapses: base.lapses,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
  };

  // A lapse now means the word genuinely decayed before the learner saw it
  // again, rather than "the learner pressed Hard". Under SM-2 those were the
  // same thing, which meant the forgotten bucket filled with merely-difficult
  // words and crowded out the ones actually being lost.
  const wasDue = base.nextReviewAt
    ? new Date(base.nextReviewAt).getTime() <= now.getTime()
    : false;
  const recall = retrievability(base, now);
  if (base.repetitions > 0 && wasDue && recall < 0.7) {
    next.lapses = base.lapses + 1;
  }

  next.status = deriveStatus(next);
  return next;
}

/**
 * Mastery bands.
 *
 * Unchanged in meaning from the SM-2 version so the Progress screen keeps
 * meaning the same thing. `ease` is gone, so "mastered" is now purely a
 * function of difficulty, which is the honest reading anyway: a word is
 * mastered when it is easy, not when a counter happens to be high.
 */
export function deriveStatus(p: WordProgress): MasteryStatus {
  if (p.repetitions === 0) return "new";
  if (p.repetitions <= 2) return "learning";
  if (p.repetitions <= 4) return "familiar";
  return p.difficulty < 0.35 ? "mastered" : "familiar";
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

/**
 * The level at which a word is worth worrying about.
 *
 * Deliberately below TARGET_RETENTION. The interval is *chosen* so a word
 * sits at exactly 0.90 when it comes back, which means a word is always at or
 * above 0.90 right up until its due date — so thresholding on retention itself
 * can never flag anything. What is useful is the point where a word starts to
 * become genuinely hard to recall, which happens well before it is formally
 * due. 0.75 is that point.
 */
const WORRY_LEVEL = 0.75;

/**
 * Met words that will drop below `Worry_LEVEL` within `withinDays`.
 *
 * This is the question SM-2 could not answer: not "what is due" but "what am I
 * losing". Words already due are excluded — they belong to the "due today"
 * bucket, and listing them twice would just pad the queue.
 *
 * The horizon matters. A word reviewed Easy holds for weeks and will not cross
 * the worry line inside a short window, so it stays out of the way; a word
 * rated Hard crosses it within hours and surfaces immediately, days before it
 * is formally scheduled.
 */
export function forgettingSoon(
  progress: Record<string, WordProgress>,
  now: Date = new Date(),
  withinDays = 3,
  threshold = WORRY_LEVEL,
): WordProgress[] {
  const horizonMs = now.getTime() + withinDays * DAY_MS;
  const horizon = new Date(horizonMs);
  const out: WordProgress[] = [];

  for (const p of Object.values(progress)) {
    if (p.status === "new" || p.repetitions === 0) continue;
    // Already due is the "due today" bucket's job, not ours.
    const dueAt = p.nextReviewAt ? new Date(p.nextReviewAt).getTime() : null;
    if (dueAt !== null && dueAt <= now.getTime()) continue;
    // Retrievability decays monotonically, so if it is still above threshold
    // at the horizon it cannot cross below it earlier.
    if (retrievability(p, horizon) >= threshold) continue;
    out.push(p);
  }

  // Soonest to slip first — how close each word is to the worry line.
  return out.sort((a, b) => retrievability(a, horizon) - retrievability(b, horizon));
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