import { resolveMeaning } from "@/lib/data";
import { normaliseAnswer } from "@/lib/engine/quiz";
import type { NativeLanguageCode, VocabularyWord } from "@/lib/types";

/**
 * Find a word in the syllabus.
 *
 * Searches the same fields the learner can see — the written form, its
 * reading, the romanization, the meaning and any other-language glosses — and
 * normalises the same way typed answers do, so diacritics and case never
 * decide whether a word is found. Matches are ranked exact > prefix >
 * substring, then by frequency rank, so the most frequent word wins a tie.
 *
 * An empty query returns the list untouched, in corpus order: browsing and
 * searching are the same screen.
 */
export function searchVocabulary(
  vocabulary: VocabularyWord[],
  query: string,
  nativeLanguage: NativeLanguageCode,
): VocabularyWord[] {
  const q = normaliseAnswer(query);
  if (!q) return vocabulary;

  const scored: { word: VocabularyWord; score: number }[] = [];

  for (const word of vocabulary) {
    const fields = [
      word.word,
      word.reading,
      word.romanized,
      resolveMeaning(word, nativeLanguage),
      ...Object.values(word.translations ?? {}),
    ];

    let score = 0;
    for (const field of fields) {
      if (!field) continue;
      const value = normaliseAnswer(field);
      if (!value) continue;
      if (value === q) score = Math.max(score, 3);
      else if (value.startsWith(q)) score = Math.max(score, 2);
      else if (value.includes(q)) score = Math.max(score, 1);
    }

    if (score > 0) scored.push({ word, score });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.word.frequencyRank - b.word.frequencyRank,
  );
  return scored.map((s) => s.word);
}
