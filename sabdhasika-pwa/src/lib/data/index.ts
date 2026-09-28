import type { LanguageCode, NativeLanguageCode, VocabularyWord } from "@/lib/types";
import { arabic } from "./arabic";
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
 * The shipped dataset. Swapping this for a network call is the only change
 * required to move to a backend — nothing above this line knows where the
 * words came from.
 */
const DATASET: Record<LanguageCode, VocabularyWord[]> = {
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
};

const BY_ID = new Map<string, VocabularyWord>();
for (const words of Object.values(DATASET)) {
  for (const w of words) BY_ID.set(w.id, w);
}

/** Rank-ordered list for a language. Always sorted by frequency. */
export function getVocabulary(language: LanguageCode): VocabularyWord[] {
  return DATASET[language] ?? [];
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
