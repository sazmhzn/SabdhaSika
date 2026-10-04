import type {
  AppState,
  RecallEntry,
  RecallMode,
  Rating,
  Settings,
  WordProgress,
} from "@/lib/types";
import { SYLLABI } from "@/lib/data";

/**
 * State schema version 3.
 *
 * **Version 2** replaced the hand-written seed vocabulary with the real corpus
 * frequency lists. Word ids were positional then (`ja-19` meant "the 19th most
 * frequent Japanese word"), so re-ranking moved almost every word and an id
 * saved under v1 no longer denoted the word it was saved for. Since
 * `WordProgress` stores only the id, there was nothing to check it against, and
 * the only honest migration was to drop the positional records.
 *
 * **Version 3** makes word ids content-derived instead of positional, which is
 * what removes that constraint: `src/lib/data/build.ts` now hashes the written
 * form, so a word keeps its identity when the corpus is rebuilt or re-ranked.
 *
 * That means the v2 -> v3 migration is a *remap* rather than a wipe. Every v2
 * id is `${language}-${rank}`; the syllabus for that language is already
 * imported here, so the word at that rank is known and its stable id can be
 * computed. Progress, sessions, recall log and bookmarks all carry over —
 * including the streak, which was never positional.
 *
 * The remap is deliberately forgiving. If a saved id cannot be resolved (a word
 * dropped out of the syllabus, a hand-edited backup, a v1 blob arriving late),
 * that one record is dropped rather than allowed to poison the whole load. The
 * alternative — failing the load — costs the learner everything to protect one
 * entry.
 */
export const STATE_VERSION = 3;

type LegacyProgress = Record<string, AppState["progress"][string]>;

function remapId(id: string, index: LegacyIndex): string | null {
  const hit = index.get(id);
  return hit ?? null;
}

/** `${language}-${rank}` -> stable id, for every word in every shipped syllabus. */
function buildLegacyIndex(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [language, words] of Object.entries(SYLLABI)) {
    for (const w of words) {
      map.set(`${language}-${w.frequencyRank}`, w.id);
    }
  }
  return map;
}
type LegacyIndex = Map<string, string>;

function remapKeys<V>(source: Record<string, V>, index: LegacyIndex): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    const next = remapId(key, index);
    if (next) out[next] = value;
  }
  return out;
}

/** Rewrite the ids inside a session, including its `wordId#pass` rating keys. */
function remapSession(
  session: AppState["sessions"][string],
  index: LegacyIndex,
): AppState["sessions"][string] | null {
  const wordIds = session.wordIds
    .map((id) => remapId(id, index))
    .filter((id): id is string => Boolean(id));
  if (wordIds.length === 0) return null;

  const remapOne = (key: string) => {
    const at = key.lastIndexOf("#");
    if (at === -1) return null;
    const next = remapId(key.slice(0, at), index);
    return next ? `${next}${key.slice(at)}` : null;
  };

  const ratings: Record<string, Rating> = {};
  for (const [key, rating] of Object.entries(session.ratings ?? {})) {
    const next = remapOne(key);
    if (next) ratings[next] = rating;
  }

  const modes: Record<string, RecallMode> = {};
  for (const [key, mode] of Object.entries(session.modes ?? {})) {
    const next = remapId(key, index);
    if (next) modes[next] = mode;
  }

  const deferrals: Record<string, number> = {};
  for (const [key, count] of Object.entries(session.deferrals ?? {})) {
    const next = remapId(key, index);
    if (next) deferrals[next] = count;
  }

  return {
    ...session,
    wordIds,
    ratings,
    modes,
    deferrals,
  };
}

/**
 * Give an SM-2 record a starting stability so the FSRS scheduler has something
 * to work from.
 *
 * Without this every previously-met word would be treated as having no history
 * and re-seeded from zero on its next review — every learner's schedule would
 * silently restart, which is exactly the disruption this migration exists to
 * avoid.
 *
 * The conversion is an estimate, not a re-derivation: the old scheduler's
 * interval was `interval * ease * factor`, so the interval it recorded is the
 * best available proxy for the stability SM-2 had arrived at. It is in the
 * right units (days) and the right direction, and FSRS refines it from the very
 * first genuine recall. Records that never got a review yet get the default
 * initial stability for their recorded interval instead.
 */
function seedStability(record: WordProgress): WordProgress {
  if (record.stability !== undefined) return record;
  if (record.repetitions === 0) return { ...record, stability: 0 };

  const days = Math.max(record.intervalDays, 0.5);
  // A word the learner kept rating Easy earned a longer interval under SM-2;
  // lift it a little so the first FSRS review is not a step backwards.
  const bonus = record.ease && record.ease > 2.6 ? 1.1 : 1;
  return { ...record, stability: Math.min(days * bonus, 365) };
}

/** Seed stability across a whole progress map, keeping each key in sync. */
function seedAll(progress: Record<string, WordProgress>): Record<string, WordProgress> {
  const out: Record<string, WordProgress> = {};
  for (const [id, record] of Object.entries(progress ?? {})) {
    out[id] = seedStability({ ...record, wordId: id });
  }
  return out;
}

function migrate2to3(input: Partial<AppState>, base: AppState): AppState {
  const index = buildLegacyIndex();

  const progress = seedAll(remapKeys(input.progress ?? {}, index) as LegacyProgress);

  const sessions: AppState["sessions"] = {};
  for (const [date, session] of Object.entries(input.sessions ?? {})) {
    const next = remapSession(session, index);
    if (next) sessions[date] = next;
  }

  const recallLog = (input.recallLog ?? [])
    .map((entry) => {
      const id = remapId(entry.wordId, index);
      return id ? { ...entry, wordId: id } : null;
    })
    .filter((entry): entry is RecallEntry => Boolean(entry));

  const bookmarks = (input.bookmarks ?? [])
    .map((id) => remapId(id, index))
    .filter((id): id is string => Boolean(id));

  return {
    version: STATE_VERSION,
    onboardedAt: input.onboardedAt,
    settings: { ...base.settings, ...(input.settings ?? {}) },
    progress,
    sessions,
    recallLog,
    streak: { ...base.streak, ...(input.streak ?? {}) },
    celebratedMilestones: input.celebratedMilestones ?? [],
    bookmarks,
  };
}

export const DEFAULT_SETTINGS: Settings = {
  targetLanguage: "ja",
  nativeLanguage: "en",
  dailyGoal: 25,
  romanization: "while-learning",
  pronunciationEnabled: true,
  autoPlayPronunciation: false,
  hapticsEnabled: true,
  soundEnabled: true,
  reminderEnabled: false,
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
    bookmarks: [],
  };
}

/** Forward-compatible merge so an older saved blob never crashes the app. */
export function migrate(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<AppState>;
  const from = typeof input.version === "number" ? input.version : 0;

  // v1 -> v2 re-ranked every word, so positional records were already
  // meaningless the moment they were written. There is nothing to remap them
  // onto: the word that used to sit at rank N is no longer known. Still a wipe.
  if (from < 2) {
    return {
      version: STATE_VERSION,
      onboardedAt: input.onboardedAt,
      settings: { ...base.settings, ...(input.settings ?? {}) },
      progress: {},
      sessions: {},
      recallLog: [],
      streak: { ...base.streak, ...(input.streak ?? {}) },
      celebratedMilestones: input.celebratedMilestones ?? [],
      bookmarks: [],
    };
  }

  // v2 -> v3 only changes what an id *is*. The words did not move, so every
  // record is recoverable by remapping through the current syllabus.
  if (from < 3) return migrate2to3(input, base);

  return {
    version: STATE_VERSION,
    onboardedAt: input.onboardedAt,
    settings: { ...base.settings, ...(input.settings ?? {}) },
    // Already current, but a record written by an intermediate build may still
    // be missing `stability`. Seeding is idempotent, so running it here is
    // free and makes the app tolerant of a half-migrated blob.
    progress: seedAll(input.progress ?? {}),
    sessions: input.sessions ?? {},
    recallLog: input.recallLog ?? [],
    streak: { ...base.streak, ...(input.streak ?? {}) },
    celebratedMilestones: input.celebratedMilestones ?? [],
    bookmarks: input.bookmarks ?? [],
  };
}
