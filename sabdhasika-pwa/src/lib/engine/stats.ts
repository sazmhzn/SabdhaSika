import { getVocabulary } from "@/lib/data";
import { DAY_MS, dayKey } from "@/lib/date";
import type { AppState, VocabularyWord, WordProgress } from "@/lib/types";
import { forgettingSoon, isDue, retrievability } from "./scheduler";

export interface ProgressStats {
  /** Every word the learner has met at least once. */
  wordsLearned: number;
  mastered: number;
  familiar: number;
  learning: number;
  untouched: number;
  totalInList: number;
  /** Inclusive frequency band the learner is currently working through. */
  currentBand: [number, number];
  bandLabel: string;
  nextMilestone: number;
  toNextMilestone: number;
  lastMilestone: number;
  masteryRatio: number;
  dueToday: number;
  difficult: number;
  forgotten: number;
  recentlyLearned: number;
}

const MILESTONES = [100, 250, 500, 1000, 2000, 3000];

function bandFor(learned: number): [number, number] {
  if (learned <= 0) return [1, 100];
  const size = 100;
  const end = Math.ceil(learned / size) * size;
  return [end - size + 1, end];
}

export function computeStats(state: AppState, now: Date = new Date()): ProgressStats {
  const vocab = getVocabulary(state.settings.targetLanguage);
  const progress = state.progress;

  let mastered = 0;
  let familiar = 0;
  let learning = 0;
  let wordsLearned = 0;
  let dueToday = 0;
  let difficult = 0;
  let forgotten = 0;
  let recentlyLearned = 0;
  const weekAgo = now.getTime() - 7 * DAY_MS;

  for (const w of vocab) {
    const p = progress[w.id];
    if (!p || p.status === "new") continue;
    wordsLearned++;
    if (p.status === "mastered") mastered++;
    else if (p.status === "familiar") familiar++;
    else learning++;

    if (isDue(p, now)) dueToday++;
    if (p.difficulty >= 0.6) difficult++;
    if (p.lapses >= 2) forgotten++;
    if (p.firstSeenAt && new Date(p.firstSeenAt).getTime() >= weekAgo) recentlyLearned++;
  }

  const nextMilestone = MILESTONES.find((m) => m > wordsLearned) ?? MILESTONES[MILESTONES.length - 1];
  const lastMilestone = [...MILESTONES].reverse().find((m) => m <= wordsLearned) ?? 0;
  const band = bandFor(wordsLearned);

  return {
    wordsLearned,
    mastered,
    familiar,
    learning,
    untouched: vocab.length - wordsLearned,
    totalInList: state.settings.targetLanguage
      ? getVocabulary(state.settings.targetLanguage).length
      : 0,
    currentBand: band,
    bandLabel: `Top ${band[1]} words`,
    nextMilestone,
    toNextMilestone: Math.max(0, nextMilestone - wordsLearned),
    lastMilestone,
    masteryRatio: wordsLearned > 0 ? mastered / wordsLearned : 0,
    dueToday,
    difficult,
    forgotten,
    recentlyLearned,
  };
}

/* ------------------------------------------------------------------ *
 * Review buckets
 * ------------------------------------------------------------------ */

export type ReviewBucketId = "slipping" | "due" | "difficult" | "forgotten" | "recent";

export interface ReviewBucket {
  id: ReviewBucketId;
  label: string;
  hint: string;
  words: VocabularyWord[];
}

export function buildReviewBuckets(state: AppState, now: Date = new Date()): ReviewBucket[] {
  const vocab = getVocabulary(state.settings.targetLanguage);
  const progress = state.progress;
  const weekAgo = now.getTime() - 7 * DAY_MS;

  // Words the learner still believes they know but are about to lose. Only
  // possible with a decay model — SM-2 could only report "due", so these words
  // used to sit unnoticed until the day they had already decayed.
  const slippingIds = new Set(
    forgettingSoon(progress, now).map((p) => p.wordId),
  );

  const slipping: VocabularyWord[] = [];
  const due: VocabularyWord[] = [];
  const difficult: VocabularyWord[] = [];
  const forgotten: VocabularyWord[] = [];
  const recent: VocabularyWord[] = [];

  for (const w of vocab) {
    const p = progress[w.id];
    if (!p || p.status === "new") continue;
    if (slippingIds.has(w.id)) slipping.push(w);
    if (isDue(p, now)) due.push(w);
    if (p.difficulty >= 0.6) difficult.push(w);
    if (p.lapses >= 2) forgotten.push(w);
    if (p.firstSeenAt && new Date(p.firstSeenAt).getTime() >= weekAgo) recent.push(w);
  }

  const byPressure = (a: VocabularyWord, b: VocabularyWord) =>
    progress[b.id].difficulty - progress[a.id].difficulty ||
    new Date(progress[a.id].nextReviewAt ?? 0).getTime() -
      new Date(progress[b.id].nextReviewAt ?? 0).getTime();

  // Soonest to slip first — the whole reason this bucket leads.
  const tomorrow = new Date(now.getTime() + DAY_MS);
  slipping.sort(
    (a, b) =>
      retrievability(progress[a.id], tomorrow) - retrievability(progress[b.id], tomorrow),
  );
  due.sort(byPressure);
  difficult.sort(byPressure);
  forgotten.sort((a, b) => progress[b.id].lapses - progress[a.id].lapses);
  recent.sort(
    (a, b) =>
      new Date(progress[b.id].firstSeenAt).getTime() -
      new Date(progress[a.id].firstSeenAt).getTime(),
  );

  return [
    {
      id: "slipping",
      label: "Slipping soon",
      hint: "You know these, but not for much longer",
      words: slipping,
    },
    { id: "due", label: "Due today", hint: "Scheduled to come back", words: due },
    { id: "difficult", label: "Difficult", hint: "You rated these Hard", words: difficult },
    { id: "forgotten", label: "Slipped away", hint: "Missed more than once", words: forgotten },
    { id: "recent", label: "Just learned", hint: "From the last seven days", words: recent },
  ];
}

/** Everything that needs attention, deduplicated, hardest first. */
export function attentionQueue(state: AppState, now: Date = new Date()): string[] {
  const buckets = buildReviewBuckets(state, now);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const bucket of [buckets[0], buckets[1], buckets[2]]) {
    for (const w of bucket.words) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      out.push(w.id);
    }
  }
  return out;
}

/**
 * Last 28 days of activity, oldest first — the consistency strip.
 *
 * Counts both session ratings and recall attempts: a day spent drilling
 * recall is study, and a strip that ignored it would tell the learner their
 * work did not happen.
 */
export function activityStrip(state: AppState, now: Date = new Date(), days = 28) {
  const recallsByDate = new Map<string, number>();
  for (const entry of state.recallLog ?? []) {
    recallsByDate.set(entry.date, (recallsByDate.get(entry.date) ?? 0) + 1);
  }

  const out: { date: string; count: number; active: boolean }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const key = dayKey(d);
    const session = state.sessions[key];
    const count = (session ? Object.keys(session.ratings).length : 0) + (recallsByDate.get(key) ?? 0);
    out.push({ date: key, count, active: count > 0 });
  }
  return out;
}

export function totalRatings(state: AppState): number {
  return Object.values(state.sessions).reduce((n, s) => n + Object.keys(s.ratings).length, 0);
}

export function totalRecalls(state: AppState): number {
  return (state.recallLog ?? []).length;
}

export function findProgress(state: AppState, wordId: string): WordProgress | undefined {
  return state.progress[wordId];
}
