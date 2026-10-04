/**
 * Domain types for SabdhaSika.
 *
 * These are deliberately UI-agnostic: the vocabulary dataset and the
 * learning engine know nothing about React. A backend can be dropped in
 * behind `VocabularyRepository` / `ProgressRepository` later without the
 * frontend changing.
 */

export type LanguageCode =
  | "ja"
  | "ko"
  | "zh"
  | "es"
  | "fr"
  | "de"
  | "ne"
  | "hi"
  | "ar"
  | "ru"
  | "asl";

/**
 * Spoken and signed languages are not interchangeable, and the difference
 * decides real behaviour rather than being a label: a signed language has no
 * speech synthesiser to call, no BCP-47 voice to pick, and no corpus frequency
 * list to rank against.
 *
 * Sign languages have no published frequency ranking — the whole ordering
 * premise of this product is built on one. So a signed track carries its own
 * `syllabusOrdinal`, ordered by how early a sign is needed in ordinary life,
 * and `frequencyRank` is left at 0 rather than faked.
 */
export type Modality = "spoken" | "signed";

/** Languages a learner can read meanings in. Superset of LanguageCode. */
export type NativeLanguageCode =
  | LanguageCode
  | "en"
  | "pt"
  | "it"
  | "bn"
  | "id"
  | "tr"
  | "vi";

export type MasteryStatus = "new" | "learning" | "familiar" | "mastered";

/** The three-button self-assessment. */
export type Rating = "hard" | "good" | "easy";

/** Lightweight, varied recall interactions. */
export type RecallMode = "reveal" | "choice" | "type" | "listen" | "speak";

export interface ExampleSentence {
  native: string;
  reading?: string;
  romanized?: string;
  translation: string;
}

export interface VocabularyWord {
  id: string;
  language: LanguageCode;
  /** The word as written in the target script. */
  word: string;
  /** Native reading (kana, pinyin-free hanzi reading, etc.). Omitted for Latin scripts. */
  reading?: string;
  /** Latin transliteration. Omitted for Latin scripts. */
  romanized?: string;
  /** Canonical English gloss. */
  meaning: string;
  /** Glosses in other native languages, keyed by code. */
  translations?: Partial<Record<NativeLanguageCode, string>>;
  partOfSpeech?: string;
  /**
   * 1 = most frequent. The spine of the whole product.
   *
   * Always 0 for a signed language, which has no corpus frequency list. Reading
   * anything meaningful out of this field on a sign track would be reading a
   * number that was never computed, so it is left honestly empty instead.
   * Use `syllabusOrdinal` for signed tracks.
   */
  frequencyRank: number;
  /**
   * Teaching order for a signed language, where no frequency corpus exists.
   *
   * Ordered by how early a sign is needed in ordinary life, not by a corpus. 1
   * comes first. Undefined for every spoken language — there, frequency rank
   * already answers "what comes next".
   */
  syllabusOrdinal?: number;
  /**
   * Raw occurrences of this word in the source corpus. Optional because the
   * dataset can be swapped for one without corpus backing; when present it is
   * what makes `frequencyRank` auditable rather than asserted.
   */
  frequency?: number;
  /**
   * Pronunciation hint (IPA / pinyin with tones / respelling).
   * Intentionally separate from `romanized` — they are not the same thing.
   */
  pronunciation?: string;
  example?: ExampleSentence;
}

export interface WordProgress {
  wordId: string;
  status: MasteryStatus;
  repetitions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  /**
   * FSRS stability, in days: how long this word is expected to hold at 90%
   * recall. Absent on records written before the FSRS migration; the scheduler
   * treats such a record as having no history and re-seeds it on first review,
   * which costs one scheduling step but never wrong content.
   */
  stability?: number;
  /** Current interval in days. A cached denormalisation of `stability`. */
  intervalDays: number;
  /** 0 = trivial, 1 = very hard. Feeds the difficulty-first review queue. */
  difficulty: number;
  /** SM-2 ease factor. Retained only so pre-FSRS records stay readable. */
  ease?: number;
  lapses: number;
  firstSeenAt: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
}

export interface Settings {
  targetLanguage: LanguageCode;
  nativeLanguage: NativeLanguageCode;
  dailyGoal: 10 | 20 | 25 | 30;
  romanization: "always" | "while-learning" | "hide-after-mastery" | "never";
  pronunciationEnabled: boolean;
  autoPlayPronunciation: boolean;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  /** Opt-in: nudge while the app is open on a day the streak is at risk. */
  reminderEnabled: boolean;
  reduceMotion: "system" | "always" | "never";
  theme: "system" | "light" | "dark";
}

export interface StreakState {
  current: number;
  longest: number;
  /** YYYY-MM-DD of the last day a session was completed. */
  lastCompletedDate?: string;
  /** Days completed, for the consistency strip. */
  history: string[];
}

export interface DailySession {
  /** YYYY-MM-DD */
  date: string;
  /** Main pass, in presentation order. */
  wordIds: string[];
  newCount: number;
  reviewCount: number;
  /** wordId -> the recall mode chosen for this appearance. */
  modes: Record<string, RecallMode>;
  /**
   * Ratings keyed by `${wordId}#${pass}`. Keying by pass means the whole
   * queue — including the "second chance" pass for words rated Hard — is
   * derivable from persisted state, so an offline reload resumes exactly
   * where the learner stopped.
   */
  ratings: Record<string, Rating>;
  /**
   * How many times each word has been pushed to the back of today's queue.
   * "I don't know this at all, show me later" is a legitimate answer, and
   * without it learners stall on one card and abandon the session.
   */
  deferrals?: Record<string, number>;
  /**
   * Words already met when this session was built. Persisted so the summary
   * can show "347 → 359" correctly even after an offline reload.
   */
  wordsAtStart?: number;
  /** True for ad-hoc sessions launched from the Review screen. */
  isReview?: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface AppState {
  version: number;
  onboardedAt?: string;
  settings: Settings;
  progress: Record<string, WordProgress>;
  sessions: Record<string, DailySession>;
  /**
   * Active-recall attempts from the Recall drill, oldest first.
   *
   * Kept separate from `sessions` on purpose: a drill is not the daily
   * session and must not count toward finishing it, but it *is* study, so
   * the consistency strip counts it. Bounded to the most recent 500.
   */
  recallLog: RecallEntry[];
  streak: StreakState;
  /** Milestones already celebrated, so we never celebrate twice. */
  celebratedMilestones: number[];
  /** Word ids the learner has saved, in the order they were saved. */
  bookmarks: string[];
}

export interface RecallEntry {
  /** ISO timestamp. Doubles as the identity of the attempt for undo. */
  at: string;
  wordId: string;
  /** YYYY-MM-DD, denormalised so the activity strip stays a cheap lookup. */
  date: string;
  /** True if the learner produced the word before seeing it. */
  remembered: boolean;
}

/* ------------------------------------------------------------------ *
 * Analytics — see the delight strategy doc. Every delight hypothesis in
 * that document maps to an event here, so the claim is falsifiable.
 * ------------------------------------------------------------------ */

export type MetricEventName =
  | "app_open"
  | "onboarding_step"
  | "onboarding_complete"
  | "session_start"
  | "first_card_ready"
  | "card_reveal"
  | "pronunciation_play"
  | "rating_given"
  | "recall_answered"
  | "recall_start"
  | "recall_complete"
  | "session_complete"
  | "milestone_reached"
  | "review_start"
  | "error_shown"
  | "offline_session"
  | "install_prompt_shown"
  | "install_accepted"
  | "word_search"
  | "word_viewed"
  | "word_saved"
  | "backup_exported"
  | "backup_imported"
  | "streak_risk_shown";

export interface MetricEvent {
  name: MetricEventName;
  at: number;
  /** Arbitrary numeric payload, e.g. { ms: 1840 } or { rating: 2 }. */
  data?: Record<string, number | string | boolean>;
}

export interface MetricSummary {
  /** Median ms from app open to the first card being interactive. */
  timeToFirstCardMs: number | null;
  /** Median ms between consecutive card ratings (pace). */
  medianRatingGapMs: number | null;
  /** Share of ratings that were "hard" — the frustration proxy. */
  hardRate: number | null;
  /** Sessions completed / sessions started. */
  sessionCompletionRate: number | null;
  /** Sessions completed on an offline-capable day. */
  offlineSessions: number;
  /**
   * Share of recall attempts where the learner produced the word before
   * seeing it. The one metric that measures *learning*, not comfort.
   */
  recallAccuracy: number | null;
  /** Total events, for sanity. */
  totalEvents: number;
}
