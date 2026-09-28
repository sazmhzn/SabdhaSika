import type { LanguageCode } from "@/lib/types";

/**
 * Measured corpus coverage — the product's central claim, as a number.
 *
 * "Learn the words that matter" is only meaningful if the words that matter
 * are a small, knowable set. This file is that claim made checkable: for each
 * language whose source publishes token counts, how much of the whole corpus
 * the top N words account for.
 *
 * ── How these were produced ─────────────────────────────────────────
 *
 * `.workbuddy-ai/coverage.mjs` reads each shipped list in
 * `src/lib/data/frequency/*.ts` and sums the recorded occurrences of the first
 * N entries against the corpus total in the same file. Regenerate with:
 *
 *     node .workbuddy-ai/coverage.mjs
 *
 * Do not hand-edit these. They are derived from the same lists the app teaches
 * from, so if the lists are rebuilt the numbers move — and a hand-typed copy
 * would then be a claim the product no longer supports. That failure has
 * already happened once in this codebase (Nepali's list size was hard-coded
 * and went stale against the real list).
 *
 * ── Why one language is missing ─────────────────────────────────────
 *
 * Japanese comes from `wordfreq`, which publishes *ranks* and no counts. There
 * is no honest coverage percentage to show for it, so it is absent rather than
 * estimated — and the Progress screen says so in words instead of showing a
 * made-up figure. Nine of the ten languages publish counts.
 */

export const COVERAGE_MILESTONES = [100, 250, 500, 1000, 2000, 3000] as const;
export type CoverageMilestone = (typeof COVERAGE_MILESTONES)[number];

/** Percentage of corpus tokens covered by the top N words. */
export type CoverageCurve = Partial<Record<CoverageMilestone, number>>;

interface CoverageFact {
  /** Tokens the corpus was counted over. */
  totalTokens: number;
  /** Entries in the shipped list. */
  listSize: number;
  coverage: CoverageCurve;
}

export const COVERAGE_BY_LANGUAGE: Partial<Record<LanguageCode, CoverageFact>> = {
  es: {
    totalTokens: 412_403_261,
    listSize: 3000,
    coverage: { 100: 52, 250: 63.2, 500: 70.4, 1000: 76.8, 2000: 82.6, 3000: 85.8 },
  },
  fr: {
    totalTokens: 290_314_117,
    listSize: 3000,
    coverage: { 100: 56, 250: 66.6, 500: 73.4, 1000: 79.5, 2000: 85, 3000: 87.8 },
  },
  de: {
    totalTokens: 151_385_359,
    listSize: 3000,
    coverage: { 100: 53, 250: 65.6, 500: 73.4, 1000: 79.9, 2000: 85.4, 3000: 88.2 },
  },
  ru: {
    totalTokens: 144_139_672,
    listSize: 3000,
    coverage: { 100: 46.6, 250: 56.8, 500: 64, 1000: 70.8, 2000: 77.1, 3000: 80.6 },
  },
  ar: {
    totalTokens: 148_302_653,
    listSize: 3000,
    coverage: { 100: 36.1, 250: 46, 500: 53.5, 1000: 61.2, 2000: 69.1, 3000: 73.6 },
  },
  hi: {
    totalTokens: 712_364,
    listSize: 3000,
    coverage: { 100: 57.1, 250: 70, 500: 77.4, 1000: 83.8, 2000: 89.5, 3000: 92.3 },
  },
  ne: {
    totalTokens: 2_731_250,
    listSize: 3000,
    coverage: { 100: 28.7, 250: 40.5, 500: 51.5, 1000: 62.9, 2000: 73.8, 3000: 79.5 },
  },
  ko: {
    totalTokens: 5_163_940,
    listSize: 3000,
    coverage: { 100: 25.1, 250: 36.6, 500: 45.4, 1000: 54.1, 2000: 62.9, 3000: 68 },
  },
  zh: {
    totalTokens: 74_700_983,
    listSize: 3000,
    coverage: { 100: 50.5, 250: 61.2, 500: 68.4, 1000: 74.9, 2000: 81, 3000: 84.3 },
  },
};

/** Every language with a shipped frequency list, including the one without counts. */
export const COVERAGE_LANGUAGE_COUNT = 10;
export const COUNTED_LANGUAGE_COUNT = Object.keys(COVERAGE_BY_LANGUAGE).length;

/**
 * The mean across every language that publishes counts.
 *
 * Deliberately the mean and not the best case: the honest headline is what the
 * product delivers on average, and the range is reported alongside it so the
 * spread between Korean (25%) and Hindi (57%) is visible rather than averaged
 * away. The landing page shows both.
 */
export function meanCoverage(milestone: CoverageMilestone): number {
  const values = Object.values(COVERAGE_BY_LANGUAGE)
    .map((fact) => fact.coverage[milestone])
    .filter((v): v is number => typeof v === "number");
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function coverageRange(milestone: CoverageMilestone): { min: number; max: number } {
  const values = Object.values(COVERAGE_BY_LANGUAGE)
    .map((fact) => fact.coverage[milestone])
    .filter((v): v is number => typeof v === "number");
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** The curve for one language, in milestone order, as `[rank, percent]` pairs. */
export function coverageCurve(language: LanguageCode): Array<[CoverageMilestone, number]> {
  const fact = COVERAGE_BY_LANGUAGE[language];
  if (!fact) return [];
  return COVERAGE_MILESTONES.flatMap((m) => {
    const value = fact.coverage[m];
    return typeof value === "number" ? [[m, value] as [CoverageMilestone, number]] : [];
  });
}

/**
 * The headline figure, computed rather than typed, so it cannot drift from the
 * data above. `Math.round` because the landing page should never claim more
 * precision than the measurement supports.
 */
export const HEADLINE_COVERAGE = {
  milestone: 100 as CoverageMilestone,
  percent: Math.round(meanCoverage(100)),
  ...coverageRange(100),
};
