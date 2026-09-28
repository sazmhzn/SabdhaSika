import { resolveMeaning } from "@/lib/data";
import { hashString, seededRandom } from "@/lib/date";
import type { NativeLanguageCode, VocabularyWord } from "@/lib/types";

export interface Choice {
  id: string;
  label: string;
}

/**
 * Distractors.
 *
 * Chosen from words *near* the target in the frequency list. Plucking
 * distractors from the whole list would make the answer obvious ("to eat"
 * among "telephone", "weather", "quiet"). Neighbours are harder, and harder
 * is what makes the correct answer feel earned.
 */
export function buildChoices(
  target: VocabularyWord,
  vocabulary: VocabularyWord[],
  nativeLanguage: NativeLanguageCode,
  count = 4,
): Choice[] {
  const targetLabel = resolveMeaning(target, nativeLanguage);
  const rand = seededRandom(hashString(`${target.id}:${nativeLanguage}`));

  const candidates = vocabulary
    .filter((w) => w.id !== target.id)
    .map((w) => ({ w, distance: Math.abs(w.frequencyRank - target.frequencyRank) }))
    .filter((c) => resolveMeaning(c.w, nativeLanguage) !== targetLabel)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 24);

  // Shuffle the near-neighbour pool, then take what we need.
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const picks = pool.slice(0, count - 1).map((c) => ({
    id: c.w.id,
    label: resolveMeaning(c.w, nativeLanguage),
  }));

  const choices = [{ id: target.id, label: targetLabel }, ...picks];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}

/** Normalise a typed answer so diacritics, case and spacing do not punish. */
export function normaliseAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[·・\s'’-]/g, "");
}

/**
 * Typed-answer checking accepts *any* of the word's forms — the native
 * script, the reading, or the romanization. A learner who types "taberu"
 * knows the word; refusing it because they did not produce 食べる would be
 * teaching typing, not vocabulary.
 */
export function checkTypedAnswer(
  input: string,
  word: VocabularyWord,
  nativeLanguage: NativeLanguageCode,
): boolean {
  const value = normaliseAnswer(input);
  if (!value) return false;
  const accepted = [word.word, word.reading, word.romanized, resolveMeaning(word, nativeLanguage)]
    .filter(Boolean)
    .map((s) => normaliseAnswer(s as string));
  return accepted.includes(value);
}

/** The "1", "2", "3" shortcut hint only makes sense on a physical keyboard. */
export const isTypingTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
};
