import type { MasteryStatus, Settings } from "@/lib/types";

/**
 * Romanization visibility.
 *
 * The point of the setting (per the spec) is to help beginners *without*
 * creating permanent dependence. "Show while learning" is the default because
 * it fades the training wheels automatically at exactly the moment the
 * learner stops needing them — no decision required.
 */
export function shouldShowRomanization(
  setting: Settings["romanization"],
  status: MasteryStatus,
): boolean {
  switch (setting) {
    case "always":
      return true;
    case "never":
      return false;
    case "while-learning":
      return status === "new" || status === "learning";
    case "hide-after-mastery":
      return status !== "mastered";
  }
}

/** A word has a romanization layer only if the script needs one. */
export function hasRomanization(word: { reading?: string; romanized?: string }): boolean {
  return Boolean(word.romanized || word.reading);
}

/** Long words need a smaller hero size so the card never overflows. */
export function heroFontSize(word: string): string {
  const n = [...word].length;
  if (n <= 2) return "clamp(3.1rem, 13vw, 5rem)";
  if (n <= 4) return "clamp(2.5rem, 10.5vw, 4.1rem)";
  if (n <= 7) return "clamp(1.9rem, 7.6vw, 3rem)";
  return "clamp(1.5rem, 5.6vw, 2.2rem)";
}

export function isRtl(language: string): boolean {
  return language === "ar";
}
