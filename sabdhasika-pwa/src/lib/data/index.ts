import type { LanguageCode, NativeLanguageCode, VocabularyWord } from "@/lib/types";
import { arabic } from "./arabic";
import { ASL, type AslWord } from "./asl";
import { chinese } from "./chinese";
import { french } from "./french";
import { german } from "./german";
import { hindi } from "./hindi";
import { japanese } from "./japanese";
import { korean } from "./korean";
import { nepali } from "./nepali";
import { russian } from "./russian";
import { spanish } from "./spanish";

/**
 * ASL projected onto the shared `VocabularyWord` shape.
 *
 * `frequencyRank` is 0 across the track and `syllabusOrdinal` carries the
 * order, because no corpus ranking exists to report. Anything that reads a
 * frequency rank to mean "how common is this" is reading a number that was
 * never computed — so it is zero rather than plausible-looking.
 */
const aslVocabulary: VocabularyWord[] = ASL.map((w: AslWord) => ({
  id: w.id,
  language: "asl",
  word: w.word,
  meaning: w.meaning,
  romanized: w.romanized,
  syllabusOrdinal: w.syllabusOrdinal,
  frequencyRank: 0,
  example: {
    native: w.handshape.cue,
    translation: w.handshape.check,
  },
}));

/**
 * The shipped dataset. Swapping this for a network call is the only change
 * required to move to a backend — nothing above this line knows where the
 * words came from.
 *
 * Exported so the state migration can resolve legacy positional ids
 * (`ja-19`) to stable ones without duplicating the syllabus.
 */
export const DATASET: Record<LanguageCode, VocabularyWord[]> = {
  ja: japanese,
  ko: korean,
  zh: chinese,
  es: spanish,
  fr: french,
  de: german,
  ne: nepali,
  hi: hindi,
  ar: arabic,
  ru: russian,
  asl: aslVocabulary,
};

/** Alias used by the state migration. */
export const SYLLABI = DATASET;

const BY_ID = new Map<string, VocabularyWord>();
for (const words of Object.values(DATASET)) {
  for (const w of words) BY_ID.set(w.id, w);
}

/**
 * Rank-ordered list for a language.
 *
 * Spoken languages sort by frequency rank. A signed language has no corpus, so
 * it sorts by its own teaching ordinal instead — otherwise every ASL entry would
 * tie at rank 0 and the order would be whatever the array happened to be.
 */
export function getVocabulary(language: LanguageCode): VocabularyWord[] {
  const list = DATASET[language] ?? [];
  const signed = language === "asl";
  return [...list].sort((a, b) =>
    signed
      ? (a.syllabusOrdinal ?? 0) - (b.syllabusOrdinal ?? 0)
      : a.frequencyRank - b.frequencyRank,
  );
}

export function getWord(id: string): VocabularyWord | undefined {
  return BY_ID.get(id);
}

export function getWords(ids: string[]): VocabularyWord[] {
  const out: VocabularyWord[] = [];
  for (const id of ids) {
    const w = BY_ID.get(id);
    if (w) out.push(w);
  }
  return out;
}

export function totalWords(language: LanguageCode): number {
  return getVocabulary(language).length;
}

/**
 * The gloss the learner actually reads. Falls back to the English gloss so a
 * half-translated dataset never shows a blank card.
 */
export function resolveMeaning(
  word: VocabularyWord,
  nativeLanguage: NativeLanguageCode,
): string {
  return word.translations?.[nativeLanguage] ?? word.meaning;
}

/** True when the shipped gloss is a real translation, not the English fallback. */
export function hasNativeGloss(
  word: VocabularyWord,
  nativeLanguage: NativeLanguageCode,
): boolean {
  return Boolean(word.translations?.[nativeLanguage]);
}

/* ------------------------------------------------------------------ *
 * VocabularyRepository — the seam for a future backend.
 * ------------------------------------------------------------------ */
export interface VocabularyRepository {
  list(language: LanguageCode): Promise<VocabularyWord[]>;
  byId(id: string): Promise<VocabularyWord | undefined>;
}

export const localVocabularyRepository: VocabularyRepository = {
  async list(language) {
    return getVocabulary(language);
  },
  async byId(id) {
    return getWord(id);
  },
};
