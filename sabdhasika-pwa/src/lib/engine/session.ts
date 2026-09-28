import { getVocabulary } from "@/lib/data";
import { DAY_MS, dayKey, hashString, seededRandom } from "@/lib/date";
import type {
  AppState,
  DailySession,
  RecallMode,
  VocabularyWord,
  WordProgress,
} from "@/lib/types";
import { isDue, overduePressure } from "./scheduler";

/**
 * Builds "today's 25 words".
 *
 * The contract with the user is one line: *today you have N words*. Which
 * words, in what mix, from which frequency band — all of that is decided
 * here and never surfaced.
 *
 * Mix (per the product spec, goal = 25):
 *   15 new · 5 recent review · 5 older review
 * and it adapts: brand-new learners get more new words, advanced learners
 * get more review, and a shortage of due words is silently reallocated.
 */

export interface QueuedCard {
  wordId: string;
  /** 1 = first sighting today, 2 = the second-chance pass. */
  pass: 1 | 2;
}

export interface SessionPlan {
  session: DailySession;
  /** The full ordered queue, already accounting for the retry pass. */
  queue: QueuedCard[];
  /** Cards not yet rated today. */
  remaining: QueuedCard[];
  wordsById: Record<string, VocabularyWord>;
}

const RECENT_WINDOW_MS = 10 * DAY_MS;

function byDifficultyThenDue(a: VocabularyWord, b: VocabularyWord, p: Record<string, WordProgress>) {
  const pa = p[a.id];
  const pb = p[b.id];
  return (
    pb.difficulty - pa.difficulty ||
    new Date(pa.nextReviewAt ?? 0).getTime() - new Date(pb.nextReviewAt ?? 0).getTime()
  );
}

function pickReviewModes(
  words: VocabularyWord[],
  progress: Record<string, WordProgress>,
  seed: number,
): Record<string, RecallMode> {
  const rand = seededRandom(seed);
  const modes: Record<string, RecallMode> = {};
  for (const w of words) {
    const p = progress[w.id];
    // Never ask a learner to *type* a word they have only just met.
    const reps = p?.repetitions ?? 0;
    const roll = rand();
    if (reps <= 1) {
      modes[w.id] = roll < 0.55 ? "choice" : "reveal";
    } else if (roll < 0.5) {
      modes[w.id] = "choice";
    } else if (roll < 0.72) {
      modes[w.id] = "type";
    } else {
      modes[w.id] = "reveal";
    }
  }
  return modes;
}

export function buildDailySession(state: AppState, now: Date = new Date()): SessionPlan {
  const { targetLanguage, dailyGoal } = state.settings;
  const progress = state.progress;
  const vocab = getVocabulary(targetLanguage);

  const seen = vocab.filter((w) => {
    const p = progress[w.id];
    return p && p.status !== "new";
  });
  const unseen = vocab.filter((w) => !progress[w.id] || progress[w.id].status === "new");
  const due = seen.filter((w) => isDue(progress[w.id], now));

  const recentDue = due
    .filter((w) => {
      const last = progress[w.id].lastReviewedAt;
      return last ? now.getTime() - new Date(last).getTime() <= RECENT_WINDOW_MS : false;
    })
    .sort((a, b) => byDifficultyThenDue(a, b, progress));

  const olderDue = due
    .filter((w) => !recentDue.includes(w))
    .sort(
      (a, b) =>
        overduePressure(progress[b.id], now) - overduePressure(progress[a.id], now) ||
        byDifficultyThenDue(a, b, progress),
    );

  // --- mix -------------------------------------------------------------
  const masteredCount = seen.filter((w) => progress[w.id].status === "mastered").length;
  const masteryRatio = seen.length > 0 ? masteredCount / seen.length : 0;

  let newShare: number;
  if (seen.length < 40) newShare = 0.62; // early learner: mostly new
  else if (masteryRatio > 0.5) newShare = 0.45; // advanced: mostly review
  else newShare = 0.55;

  let newCount = Math.round(dailyGoal * newShare);
  let reviewCount = dailyGoal - newCount;

  // A shortage of due words is reallocated to new words, never left empty.
  if (reviewCount > due.length) {
    newCount += reviewCount - due.length;
    reviewCount = due.length;
  }
  if (newCount > unseen.length) {
    const spare = newCount - unseen.length;
    newCount = unseen.length;
    reviewCount = Math.min(dailyGoal - newCount, due.length) + Math.min(spare, 0);
  }
  newCount = Math.max(0, Math.min(newCount, dailyGoal));
  reviewCount = Math.max(0, Math.min(reviewCount, dailyGoal - newCount));

  const recentTake = Math.min(Math.ceil(reviewCount / 2), recentDue.length);
  const olderTake = Math.min(reviewCount - recentTake, olderDue.length);
  // If one pool is short, top up from the other before touching new words.
  const shortfall = reviewCount - recentTake - olderTake;
  const recentExtra = shortfall > 0 ? Math.min(shortfall, recentDue.length - recentTake) : 0;

  const reviewWords = [
    ...recentDue.slice(0, recentTake + recentExtra),
    ...olderDue.slice(0, olderTake),
  ];
  const newWords = unseen.slice(0, Math.min(newCount + Math.max(0, shortfall - recentExtra), unseen.length));

  // --- interleave so the session opens with something new and easy -------
  const ordered: VocabularyWord[] = [];
  const newQueue = [...newWords];
  const reviewQueue = [...reviewWords];
  let toggle = 0;
  while (newQueue.length || reviewQueue.length) {
    if (toggle % 2 === 0 && newQueue.length) ordered.push(newQueue.shift()!);
    else if (reviewQueue.length) ordered.push(reviewQueue.shift()!);
    else if (newQueue.length) ordered.push(newQueue.shift()!);
    toggle++;
  }

  const seed = hashString(`${targetLanguage}:${dayKey(now)}`);
  const modes = pickReviewModes(ordered, progress, seed);
  for (const w of newWords) modes[w.id] = "reveal"; // new words are always "learn" cards

  const date = dayKey(now);
  const previous = state.sessions[date];
  const wordsAtStart =
    previous?.wordsAtStart ??
    Object.values(progress).filter((p) => p.status !== "new").length;
  const session: DailySession = {
    date,
    wordIds: ordered.map((w) => w.id),
    newCount: newWords.length,
    reviewCount: reviewWords.length,
    modes,
    // Preserve today's answers if the app was already opened today.
    ratings: previous?.ratings ?? {},
    deferrals: previous?.deferrals,
    wordsAtStart,
    startedAt: previous?.startedAt,
    completedAt: previous?.completedAt,
  };

  const wordsById: Record<string, VocabularyWord> = {};
  for (const w of vocab) wordsById[w.id] = w;

  return {
    session,
    queue: deriveQueue(session),
    remaining: deriveQueue(session).filter((c) => !session.ratings[`${c.wordId}#${c.pass}`]),
    wordsById,
  };
}

/** Ad-hoc session launched from the Review screen. */
export function buildReviewSession(
  state: AppState,
  wordIds: string[],
  now: Date = new Date(),
): SessionPlan {
  const vocab = getVocabulary(state.settings.targetLanguage);
  const wordsById: Record<string, VocabularyWord> = {};
  for (const w of vocab) wordsById[w.id] = w;
  const ordered = wordIds.map((id) => wordsById[id]).filter(Boolean);

  const session: DailySession = {
    date: dayKey(now),
    wordIds: ordered.map((w) => w.id),
    newCount: 0,
    reviewCount: ordered.length,
    modes: pickReviewModes(ordered, state.progress, hashString(`review:${dayKey(now)}`)),
    ratings: {},
    wordsAtStart: Object.values(state.progress).filter((p) => p.status !== "new").length,
    isReview: true,
    startedAt: now.toISOString(),
  };

  return { session, queue: deriveQueue(session), remaining: deriveQueue(session), wordsById };
}

/**
 * The queue is a pure function of the session record — which is why an
 * offline reload resumes perfectly, and why "Hard" words come back exactly
 * once at the end rather than in an unpredictable place.
 */
export function deriveQueue(session: DailySession): QueuedCard[] {
  const deferrals = session.deferrals ?? {};
  // Deferred cards keep their relative order but move behind everything that
  // has not been deferred — one deferral is enough to put a card last.
  const first: QueuedCard[] = session.wordIds
    .map((wordId, index) => ({ wordId, index, d: deferrals[wordId] ?? 0 }))
    .sort((a, b) => a.d - b.d || a.index - b.index)
    .map(({ wordId }) => ({ wordId, pass: 1 as const }));

  const retry: QueuedCard[] = session.wordIds
    .filter((id) => session.ratings[`${id}#1`] === "hard")
    .map((wordId) => ({ wordId, pass: 2 as const }));

  return [...first, ...retry];
}

export function ratingKey(card: QueuedCard): string {
  return `${card.wordId}#${card.pass}`;
}

export function isSessionComplete(session: DailySession): boolean {
  if (session.wordIds.length === 0) return false;
  return deriveQueue(session).every((c) => Boolean(session.ratings[ratingKey(c)]));
}

export function sessionProgress(session: DailySession): { done: number; total: number } {
  const queue = deriveQueue(session);
  const done = queue.filter((c) => session.ratings[ratingKey(c)]).length;
  return { done, total: queue.length };
}
