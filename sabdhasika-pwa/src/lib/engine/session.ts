import { getVocabulary } from "@/lib/data";
import { DAY_MS, dayKey, hashString, seededRandom } from "@/lib/date";
import { speechAvailable } from "@/lib/audio";
import { speechInputAvailable } from "@/lib/speech-input";
import type {
  AppState,
  DailySession,
  LanguageCode,
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

/** Floor and ceiling on the adaptive queue size. */
const MIN_DAILY = 8;

/** How many finished days to look back when judging a learner's appetite. */
const CAPACITY_WINDOW = 7;

/**
 * How many words this learner can realistically do today.
 *
 * The old behaviour was a fixed `dailyGoal` every single day, chosen by the
 * learner in onboarding and never revisited. That is a promise the app cannot
 * keep honestly — somebody having a bad week still gets handed 30 cards, and the
 * most common way a learner stops using a daily app is by failing the daily
 * promise repeatedly rather than by finding it too hard.
 *
 * So the goal becomes a ceiling and the actual queue is sized from how the last
 * few days actually went. Review accuracy is the signal: days where most
 * answers were "hard" are days the learner was overwhelmed, and the honest
 * response is a shorter day rather than the same day again.
 *
 * Deliberately bounded at both ends. Never below `MIN_DAILY`, because a queue
 * too short to feel like progress is its own failure mode; never above
 * `dailyGoal`, because the learner set that ceiling deliberately.
 *
 * With no history at all this returns the full goal — a new learner has told
 * us nothing yet, so we take them at their word.
 */
export function estimateCapacity(state: AppState, now: Date = new Date()): number {
  const goal = state.settings.dailyGoal;
  const finished = Object.values(state.sessions)
    .filter((s) => s.completedAt && s.wordIds.length > 0 && !s.isReview)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, CAPACITY_WINDOW);

  if (finished.length === 0) return goal;

  // Mean share of cards the learner rated "hard", weighted toward recent days.
  // The weighting is steeply geometric: a learner who has just improved should
  // see a longer day *today*, not in three days' time. An arithmetic recency
  // weight is too weak to move the number at all — six hard days swamp one good
  // one — which would mean the app ignored the most recent evidence.
  let weight = 0;
  let weightedHard = 0;
  for (const [i, session] of finished.entries()) {
    const recency = Math.pow(0.55, i);
    const ratings = Object.values(session.ratings);
    if (ratings.length === 0) continue;
    const hard = ratings.filter((r) => r === "hard").length / ratings.length;
    weightedHard += hard * recency;
    weight += recency;
  }
  if (weight === 0) return goal;

  const hardRate = weightedHard / weight;

  /*
   * How far this learner is from cruising, 0..1, where 0 means "every answer
   * was hard" and 1 means "none were".
   *
   * `hardRate` alone is far too twitchy. A weighted average over a week means
   * one bad day out of six sits around 0.17, and mapping that onto the queue
   * collapses a 25-word day to 8 — so a single tired evening would undo weeks
   * of steady work and read to the learner as the app giving up on them.
   *
   * Two things temper it. The response is a power curve, so ordinary weeks stay
   * near the goal and only sustained difficulty pulls it down. And the weighted
   * average is taken against a floor rather than a fixed point, which stops one
   * strong run of good days from being cancelled by a single bad one.
   */
  const CONTROL = 0.25; // the weighted hard-rate treated as "a very hard week"
  const eased = clamp01((CONTROL - hardRate) / CONTROL);
  // 0.5 keeps mid-range weeks close to the goal instead of halving the queue.
  const shaped = Math.pow(eased, 0.5);
  // Never drop more than a third of the goal in one step.
  const capped = Math.max(shaped, MIN_SCALE);

  return Math.round(MIN_DAILY + capped * (goal - MIN_DAILY));
}

/** Never shrink below this share of the goal, however hard the week went. */
const MIN_SCALE = 2 / 3;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function byDifficultyThenDue(a: VocabularyWord, b: VocabularyWord, p: Record<string, WordProgress>) {
  const pa = p[a.id];
  const pb = p[b.id];
  return (
    pb.difficulty - pa.difficulty ||
    new Date(pa.nextReviewAt ?? 0).getTime() - new Date(pb.nextReviewAt ?? 0).getTime()
  );
}

/**
 * Position of a word in its syllabus.
 *
 * A spoken language is ordered by corpus frequency rank — the spine of the
 * product. A signed language has no corpus, so it is ordered by the ordinal its
 * track supplies. Falling back to frequency rank for a signed track would order
 * it by a field that is 0 on every entry.
 */
function positionInSyllabus(w: VocabularyWord, signed: boolean): number {
  return signed ? (w.syllabusOrdinal ?? Number.MAX_SAFE_INTEGER) : w.frequencyRank;
}

/**
 * Which interactions this card can use.
 *
 * The point of this function is that a mode is never offered unless the device
 * can actually perform it. `listen` needs a speech synthesiser and `speak`
 * needs a recogniser, and both are absent often enough — Linux desktops, most
 * iOS browsers, anywhere the OS ships no voice for the language — that offering
 * them blindly would hand the learner a button that cannot work.
 *
 * New words are always `reveal`: there is nothing yet to recall.
 */
function pickReviewModes(
  words: VocabularyWord[],
  progress: Record<string, WordProgress>,
  seed: number,
  capabilities: { canSpeak: boolean; canListen: boolean },
): Record<string, RecallMode> {
  const rand = seededRandom(seed);
  const modes: Record<string, RecallMode> = {};

  // Relative weights once a word is familiar. Recognition is the easiest mode
  // and gets the least: repeating it every day teaches nothing new, and a
  // session that is all recognition is a session that never builds recall.
  const WEIGHTS: Array<[RecallMode, number]> = [
    ["choice", 0.3],
    ["type", 0.2],
    ["reveal", 0.16],
    ...(capabilities.canListen ? ([["listen", 0.18]] as Array<[RecallMode, number]>) : []),
    ...(capabilities.canSpeak ? ([["speak", 0.16]] as Array<[RecallMode, number]>) : []),
  ];

  for (const w of words) {
    const p = progress[w.id];
    // Never ask a learner to *type* a word they have only just met.
    const reps = p?.repetitions ?? 0;
    if (reps <= 1) {
      modes[w.id] = rand() < 0.55 ? "choice" : "reveal";
      continue;
    }
    const roll = rand();
    let acc = 0;
    for (const [mode, weight] of WEIGHTS) {
      acc += weight;
      if (roll < acc) {
        modes[w.id] = mode;
        break;
      }
    }
    // Floating-point fallthrough: never leave a card without a mode.
    modes[w.id] ??= "reveal";
  }
  return modes;
}

/**
 * What this device can do.
 *
 * The two are different questions and it is easy to swap them: `listen` plays
 * audio and so needs a *synthesiser*, while `speak` captures the learner and
 * needs a *recogniser*.
 *
 * A signed language has neither — there is no voice in it to synthesise or
 * recognise — so both modes are unavailable regardless of the device.
 *
 * Resolved once per session build rather than per card, so every card in a
 * session is judged by the same capability snapshot — a card that changed
 * interaction mid-session would break the rhythm the queue is built on.
 */
function deviceCapabilities(language: LanguageCode): { canSpeak: boolean; canListen: boolean } {
  if (language === "asl") return { canListen: false, canSpeak: false };
  return { canListen: speechAvailable(), canSpeak: speechInputAvailable() };
}

export function buildDailySession(state: AppState, now: Date = new Date()): SessionPlan {
  const { targetLanguage } = state.settings;
  // The learner's setting is a ceiling; the day's actual size adapts to how
  // the last few days went. See `estimateCapacity`.
  const dailyGoal = estimateCapacity(state, now);
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
  // --- new-word selection -------------------------------------------------
  // Sort unseen by frequency so the curated low-rank greetings and everyday
  // words sit alongside the particles at the front of the course, and so the
  // window below is frequency-ordered before being shuffled for variety.
  const signed = targetLanguage === "asl";
  const unseenSorted = [...unseen].sort(
    (a, b) => positionInSyllabus(a, signed) - positionInSyllabus(b, signed),
  );

  // A learner should never be handed the *same* opening every day, and never
  // only grammar particles. We take the earliest WINDOW unseen words (a mix of
  // particles + the curated greetings/content words), lock the CORE most
  // frequent so the essentials always appear, then seeded-shuffle the rest so
  // each day surfaces a different fresh mix. The seed is the calendar day, so
  // "today's 25 words" stays stable within a day but varies day to day.
  const WINDOW = 34;
  const CORE = 6;
  const pool = unseenSorted.slice(0, WINDOW);
  const coreWords = pool.slice(0, Math.min(CORE, pool.length));
  const poolRest = pool.slice(CORE);
  const dayRand = seededRandom(hashString(`${targetLanguage}:${dayKey(now)}:new`));
  const shuffledRest = [...poolRest];
  for (let i = shuffledRest.length - 1; i > 0; i--) {
    const j = Math.floor(dayRand() * (i + 1));
    const tmp = shuffledRest[i];
    shuffledRest[i] = shuffledRest[j];
    shuffledRest[j] = tmp;
  }
  const orderedUnseen = [...coreWords, ...shuffledRest];

  const newWords = orderedUnseen.slice(
    0,
    Math.min(newCount + Math.max(0, shortfall - recentExtra), orderedUnseen.length),
  );

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
  const modes = pickReviewModes(ordered, progress, seed, deviceCapabilities(targetLanguage));
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
    modes: pickReviewModes(
      ordered,
      state.progress,
      hashString(`review:${dayKey(now)}`),
      deviceCapabilities(state.settings.targetLanguage),
    ),
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
