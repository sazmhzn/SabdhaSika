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

export function makeWord(language: LanguageCode, s: WordSpec): VocabularyWord {
  return {
    id: `${language}-${s.rank}`,
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
