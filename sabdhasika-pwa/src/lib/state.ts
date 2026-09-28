import type { AppState, Settings } from "@/lib/types";

/**
 * Bumped to 2 when the seed vocabulary was replaced with the real corpus
 * frequency lists.
 *
 * Word ids are positional (`ja-19` is "the 19th most frequent Japanese word"),
 * and re-ranking against a real corpus moved almost every word. So an id saved
 * under version 1 no longer denotes the word it was saved for — carrying the
 * old records forward would credit the learner with words they never met and
 * schedule reviews for the wrong cards. `WordProgress` stores only the id, not
 * the word itself, so there is nothing to check the id against: the only
 * honest migration is to drop the positional records.
 *
 * What survives is everything that is not positional: settings, the streak
 * (a record of days studied, not of which words), the onboarding date, and
 * milestones already celebrated — so nobody is congratulated twice for a
 * milestone the reset would otherwise re-arm.
 */
export const STATE_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  targetLanguage: "ja",
  nativeLanguage: "en",
  dailyGoal: 25,
  romanization: "while-learning",
  pronunciationEnabled: true,
  autoPlayPronunciation: false,
  hapticsEnabled: true,
  soundEnabled: true,
  reduceMotion: "system",
  theme: "system",
};

export function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    progress: {},
    sessions: {},
    recallLog: [],
    streak: { current: 0, longest: 0, history: [] },
    celebratedMilestones: [],
  };
}

/** Forward-compatible merge so an older saved blob never crashes the app. */
export function migrate(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<AppState>;
  const from = typeof input.version === "number" ? input.version : 0;
  const reranked = from < 2;
  return {
    version: STATE_VERSION,
    onboardedAt: input.onboardedAt,
    settings: { ...base.settings, ...(input.settings ?? {}) },
    progress: reranked ? {} : (input.progress ?? {}),
    sessions: reranked ? {} : (input.sessions ?? {}),
    recallLog: reranked ? [] : (input.recallLog ?? []),
    streak: { ...base.streak, ...(input.streak ?? {}) },
    celebratedMilestones: input.celebratedMilestones ?? [],
  };
}
