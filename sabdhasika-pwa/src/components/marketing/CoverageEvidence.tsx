import {
  COVERAGE_BY_LANGUAGE,
  COVERAGE_MILESTONES,
  COUNTED_LANGUAGE_COUNT,
  coverageRange,
  meanCoverage,
  type CoverageMilestone,
} from "@/lib/corpus-facts";
import { getLanguage } from "@/lib/languages";
import type { LanguageCode } from "@/lib/types";

/**
 * The evidence.
 *
 * The product's entire pitch is "these words are the ones that matter", and
 * that is a falsifiable claim — so the page makes it falsifiable rather than
 * asserting it. Every number here is computed from the same lists the app
 * teaches from (see `@/lib/corpus-facts`), which is why nothing is typed in by
 * hand and why one language is missing rather than estimated.
 *
 * ── Why the range is drawn and not just the mean ────────────────────
 *
 * A single "45% covered" bar would be the most flattering framing available:
 * it hides that Korean's top hundred buys 25% while Hindi's buys 57%. That gap
 * is a property of the languages, not a defect, and a learner choosing what to
 * study is better served by seeing it. So each row draws the spread as a band
 * and marks the mean on top of it.
 *
 * ── Why the bars are grey ───────────────────────────────────────────
 *
 * The obvious move is to paint the mean bar acid lime, and it is the wrong one:
 * lime means "this is the primary action" everywhere else on the site, and a
 * chart that borrows it makes the closing button's accent mean two things at
 * once. A bright neutral reads just as strongly against near-black and leaves
 * the accent intact. The band behind it steps one rung down the same surface
 * ladder, so the two encode different things without either being a colour.
 */
export function CoverageEvidence() {
  const extremes = spreadExtremes(100);

  return (
    <section id="evidence" className="scroll-mt-24 border-t border-graphite bg-void">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-20 lg:px-10 lg:py-24">
        <div className="max-w-[62ch]">
          <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
            The evidence
          </p>
          <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.75rem)] font-[510] leading-[1.08] tracking-[-0.028em] text-white">
            How much of a language
            <br />
            a hundred words buy.
          </h2>
          <p className="mt-6 text-[15.5px] leading-relaxed text-fog">
            Counted directly from the shipped corpus lists — every occurrence of every word,
            summed against the corpus total. Nine of the ten languages publish token counts;
            Japanese comes from a source that publishes ranks only, so it is absent here rather
            than guessed at.
          </p>
        </div>

        {/* ── the curve ─────────────────────────────────────────────── */}
        <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <div className="flex items-baseline justify-between gap-4 border-b border-graphite pb-3">
              <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
                Words learned
              </p>
              <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
                Corpus covered
              </p>
            </div>

            <dl className="mt-6 flex flex-col gap-7">
              {COVERAGE_MILESTONES.map((milestone) => (
                <CoverageRow key={milestone} milestone={milestone} />
              ))}
            </dl>

            <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px] text-ash">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-6 rounded-full bg-mist" aria-hidden="true" />
                mean across {COUNTED_LANGUAGE_COUNT} languages
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-6 rounded-full bg-smoke" aria-hidden="true" />
                lowest to highest
              </span>
            </p>
          </div>

          {/* ── the spread, named ───────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="rounded-mkt border border-graphite bg-carbon p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
              <h3 className="text-[13.5px] font-[510] text-bone">
                The spread is the language, not the method
              </h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-fog">
                At the top hundred words the {COUNTED_LANGUAGE_COUNT} languages diverge widely.
                That is a fact about how each one packs meaning into its most common words — not a
                difference in how carefully the lists were built.
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                <ExtremeRow label="Highest" language={extremes.max} value={extremes.maxValue} />
                <ExtremeRow label="Lowest" language={extremes.min} value={extremes.minValue} />
              </ul>
            </div>

            <div className="rounded-mkt border border-graphite bg-obsidian p-5">
              <h3 className="text-[13.5px] font-[510] text-bone">Why this is worth knowing</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-fog">
                It sets an honest expectation. If you are learning Korean, a hundred words will not
                feel like a hundred words in Hindi — and being told that up front is more useful
                than a headline that averages the difference away.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoverageRow({ milestone }: { milestone: CoverageMilestone }) {
  const mean = meanCoverage(milestone);
  const { min, max } = coverageRange(milestone);
  const rounded = Math.round(mean);
  const minRounded = Math.round(min);
  const maxRounded = Math.round(max);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-[15px] font-[510] text-mist tabular-nums">
          {milestone.toLocaleString()}
        </dt>
        <dd className="flex items-baseline gap-3">
          <span className="text-[11.5px] text-ash tabular-nums">
            {minRounded}–{maxRounded}%
          </span>
          <span className="w-[3.2rem] text-right text-[19px] font-[590] leading-none tracking-[-0.02em] text-white tabular-nums">
            {rounded}%
          </span>
        </dd>
      </div>

      {/* The bar. Widths are percentages of the track, so the scale is the
          measurement itself and not a normalised one. */}
      <div
        className="relative mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-graphite"
        role="img"
        aria-label={`Top ${milestone} words cover ${rounded}% of the corpus on average, ranging from ${minRounded}% to ${maxRounded}% across ${COUNTED_LANGUAGE_COUNT} languages.`}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-smoke"
          style={{ width: `${max}%` }}
        />
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-mist"
          style={{ width: `${mean}%` }}
        />
      </div>
    </div>
  );
}

function ExtremeRow({
  label,
  language,
  value,
}: {
  label: string;
  language: LanguageCode;
  value: number;
}) {
  const meta = getLanguage(language);
  return (
    <li className="flex items-center justify-between gap-3 text-[13px]">
      <span className="flex items-center gap-2.5">
        <span className="w-[3.4rem] text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
          {label}
        </span>
        <span className="font-[510] text-mist">{meta.name}</span>
        <span className="text-fog">{meta.nativeName}</span>
      </span>
      <span className="font-[590] text-white tabular-nums">{Math.round(value)}%</span>
    </li>
  );
}

/** The languages at each end of the top-100 spread. */
function spreadExtremes(milestone: CoverageMilestone): {
  min: LanguageCode;
  minValue: number;
  max: LanguageCode;
  maxValue: number;
} {
  const entries = Object.entries(COVERAGE_BY_LANGUAGE).flatMap(([code, fact]) => {
    const value = fact.coverage[milestone];
    return typeof value === "number" ? [{ code: code as LanguageCode, value }] : [];
  });
  const min = entries.reduce((a, b) => (b.value < a.value ? b : a));
  const max = entries.reduce((a, b) => (b.value > a.value ? b : a));
  return { min: min.code, minValue: min.value, max: max.code, maxValue: max.value };
}
