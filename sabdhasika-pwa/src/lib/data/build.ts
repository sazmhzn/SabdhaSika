import type {
  ExampleSentence,
  LanguageCode,
  NativeLanguageCode,
  VocabularyWord,
} from "@/lib/types";

/** [native, translation, reading?, romanized?] */
export type ExampleTuple = [string, string, string?, string?];

export interface WordSpec {
  /** 1 = most frequent. */
  rank: number;
  word: string;
  meaning: string;
  reading?: string;
  romanized?: string;
  pos?: string;
  /** IPA / tonal pinyin / respelling. Deliberately not the romanization. */
  ipa?: string;
  /** Raw occurrences in the source corpus. */
  freq?: number;
  ex?: ExampleTuple;
  /** Glosses in other native languages. */
  tr?: Partial<Record<NativeLanguageCode, string>>;
}

function toExample(t: ExampleTuple): ExampleSentence {
  const [native, translation, reading, romanized] = t;
  return { native, translation, reading, romanized };
}

/**
 * FNV-1a, 32-bit. Not a cryptographic hash and does not need to be — it only
 * has to make a collision between two words of the same language improbable.
 * 32 bits over a few hundred words per language makes that safe.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 16777619 via Math.imul, which is the exact 32-bit multiply.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A word's identity, derived from the word itself.
 *
 * This used to be `${language}-${rank}`, which made a word's id mean "whatever
 * sits at position N in the corpus today". Re-ranking against a real frequency
 * list then silently re-pointed every id at a different word, and because
 * `WordProgress` stores only the id there was nothing to detect the mismatch —
 * so migrating from state version 1 had to *drop* every learner's progress
 * rather than carry it forward.
 *
 * Hashing the written form makes the id stable: a word keeps its identity when
 * the corpus is rebuilt, when ranks shift, when a new source is added, and
 * when the list grows. That is what `CONTEXT.md` means by "a stable, opaque
 * identity, independent of its frequency rank", and it is what makes progress
 * migratable instead of disposable.
 *
 * Case-folded, so `Apple` and `apple` cannot both occupy a syllabus slot.
 */
export function wordId(language: LanguageCode, word: string): string {
  return `${language}-${fnv1a(word.trim().toLowerCase())}`;
}

export function makeWord(language: LanguageCode, s: WordSpec): VocabularyWord {
  return {
    id: wordId(language, s.word),
    language,
    frequencyRank: s.rank,
    word: s.word,
    meaning: s.meaning,
    ...(s.reading ? { reading: s.reading } : {}),
    ...(s.romanized ? { romanized: s.romanized } : {}),
    ...(s.pos ? { partOfSpeech: s.pos } : {}),
    ...(s.ipa ? { pronunciation: s.ipa } : {}),
    ...(s.freq !== undefined ? { frequency: s.freq } : {}),
    ...(s.ex ? { example: toExample(s.ex) } : {}),
    ...(s.tr ? { translations: s.tr } : {}),
  };
}

export function makeWords(language: LanguageCode, specs: WordSpec[]): VocabularyWord[] {
  return specs.map((s) => makeWord(language, s));
}
