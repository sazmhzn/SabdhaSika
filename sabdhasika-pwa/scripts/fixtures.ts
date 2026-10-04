import type { AppState, WordProgress } from "@/lib/types";

function progress(wordId: string, reps = 3): WordProgress {
  return {
    wordId,
    status: "familiar",
    repetitions: reps,
    correctAnswers: reps,
    incorrectAnswers: 1,
    ease: 2.5,
    intervalDays: 6,
    difficulty: 0.3,
    lapses: 0,
    firstSeenAt: "2026-09-01T00:00:00.000Z",
    lastReviewedAt: "2026-09-20T00:00:00.000Z",
    nextReviewAt: "2026-09-26T00:00:00.000Z",
  };
}

/**
 * A realistic v2 blob: positional ids, ratings keyed `${id}#pass`.
 *
 * Ranks 1, 3 and 19 are real corpus positions in the Japanese syllabus (ranks
 * are deliberately sparse — curated additions sit at decimal ranks, so not
 * every integer exists).
 */
function v2State(): AppState {
  const target = new Date().toISOString().slice(0, 10);
  return {
    version: 2,
    onboardedAt: "2026-09-01T00:00:00.000Z",
    settings: {
      targetLanguage: "ja",
      nativeLanguage: "ne",
      dailyGoal: 20,
      romanization: "while-learning",
      pronunciationEnabled: true,
      autoPlayPronunciation: false,
      hapticsEnabled: true,
      soundEnabled: true,
      reminderEnabled: false,
      reduceMotion: "system",
      theme: "dark",
    },
    progress: {
      "ja-1": progress("ja-1"),
      "ja-3": progress("ja-3", 4),
      "ja-19": progress("ja-19", 7),
    },
    sessions: {
      [target]: {
        date: target,
        wordIds: ["ja-1", "ja-3", "ja-19"],
        newCount: 1,
        reviewCount: 2,
        modes: { "ja-1": "reveal", "ja-19": "choice" },
        ratings: { "ja-1#1": "good", "ja-19#1": "easy", "ja-19#2": "hard" },
        deferrals: { "ja-1": 2 },
        wordsAtStart: 340,
        startedAt: "2026-09-26T02:00:00.000Z",
      },
    },
    recallLog: [
      { at: "2026-09-25T10:00:00.000Z", wordId: "ja-19", date: "2026-09-25", remembered: true },
    ],
    streak: { current: 12, longest: 30, lastCompletedDate: "2026-09-25", history: ["2026-09-25"] },
    celebratedMilestones: [100, 250],
    bookmarks: ["ja-19", "ja-1"],
  };
}

export { progress, v2State };