import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { marketingButtonClasses } from "@/components/ui/button-classes";
import { HeroStack } from "@/components/marketing/HeroStack";
import { PrimaryCta } from "@/components/marketing/PrimaryCta";
import { japanese } from "@/lib/data/japanese";
import {
  COUNTED_LANGUAGE_COUNT,
  COVERAGE_LANGUAGE_COUNT,
  HEADLINE_COVERAGE,
} from "@/lib/corpus-facts";
import { getLanguage } from "@/lib/languages";

/**
 * The hero.
 *
 * ── Why this is a server component ──────────────────────────────────
 *
 * The card below is a real flashcard carrying a real word from the shipped
 * dataset, and that is the whole argument of the page — so it has to be the
 * actual product, not a screenshot of it. Resolving the word on the server
 * means the card is static HTML: no word data is shipped to the browser, the
 * first paint has the headline and the card in it, and the page works with
 * JavaScript still loading. The entrance is a CSS animation (`animate-rise`)
 * rather than a motion library, for the same reason.
 *
 * ── Why the demo words are chosen by rule ───────────────────────────
 *
 * Hand-picking words would be a claim the dataset does not back the moment
 * the list is rebuilt — the same failure that had Nepali advertising a 2,000
 * word list against a real one of 3,000. So the rule is "the five
 * highest-frequency words that actually carry an example sentence", with a
 * fallback chain that always terminates. Today the top card resolves to
 * `する` at rank 19.
 *
 * Japanese is the language used because it is the hardest case: a non-Latin
 * script with a reading layer, which is what the app was built for. The card
 * shows the romanization because a visitor who cannot read kana still has to
 * be able to tell what the product does.
 *
 * ── Why the stack is a client island ─────────────────────────────────
 *
 * Everything else on this page is static HTML. The dropping stack needs
 * pointer input and GSAP, so only the stack itself (`<HeroStack>`) is a
 * client component — it renders the same card markup on the server first,
 * then hydrates the drag/click/keyboard motion. Drops are visual-only here:
 * the deck loops and nothing is recorded.
 *
 * ── The type does the emphasis, not an accent colour ────────────────
 *
 * The headline sets most of itself in `mist` and lifts one word to `white`.
 * The obvious alternative — painting that word acid lime — is the one thing
 * this design language reserves: lime means "the primary action on this
 * screen", and spending it on a word in a headline is how a single accent
 * stops being an accent. Dimming the surroundings achieves the same emphasis
 * and costs nothing.
 */
const TOP_WITH_EXAMPLE = japanese.filter((w) => w.example && w.frequencyRank <= 100);
const ANY_WITH_EXAMPLE = japanese.filter((w) => w.example);
const DECK = (
  TOP_WITH_EXAMPLE.length >= 3
    ? TOP_WITH_EXAMPLE
    : ANY_WITH_EXAMPLE.length >= 3
      ? ANY_WITH_EXAMPLE
      : japanese
).slice(0, 5);

export function Hero() {
  const language = getLanguage("ja");

  return (
    <section className="relative overflow-x-clip">
      <div className="relative mx-auto grid w-full max-w-[1200px] gap-16 px-6 pb-20 pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-20 lg:pb-24 lg:pt-24">
        {/* ── the pitch ─────────────────────────────────────────────── */}
        <div>
          <p
            className="animate-rise inline-flex items-center gap-2 rounded-full border border-graphite bg-carbon px-3 py-1.5 text-[12px] font-[450] text-fog"
            style={{ animationDelay: "0ms" }}
          >
            <span className="size-1.5 rounded-full bg-acid" aria-hidden="true" />
            {language.name} · top 3,000 words · offline-first
          </p>

          <h1
            className="animate-rise mt-6 text-[clamp(2.5rem,6vw,4.25rem)] font-[510] leading-[1.02] tracking-[-0.032em] text-mist"
            style={{ animationDelay: "60ms" }}
          >
            Learn the words
            <br />
            that actually <span className="text-white">carry</span>
            <br />
            the language.
          </h1>

          <p
            className="animate-rise mt-7 max-w-[54ch] text-[16px] leading-relaxed text-fog lg:text-[16.5px]"
            style={{ animationDelay: "120ms" }}
          >
            Most vocabulary lists are somebody&rsquo;s guess. SabdhaSika teaches from real corpus
            frequency, in rank order — so the first hundred words you learn are the hundred that
            appear most often in speech and writing.
          </p>

          <div
            className="animate-rise mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "180ms" }}
          >
            <PrimaryCta
              href="/register"
              size="lg"
              label="Start learning"
              icon={<ArrowRight className="size-4" strokeWidth={2} />}
            />
            <Link
              href="/signin"
              className={marketingButtonClasses({ variant: "secondary", size: "lg" })}
            >
              Sign in
            </Link>
          </div>

          <p
            className="animate-rise mt-6 flex items-start gap-2.5 text-[13px] leading-relaxed text-ash"
            style={{ animationDelay: "240ms" }}
          >
            <Lock className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>
              No server account and no tracking. Your progress is written to this device, which is
              also why it keeps working with the network off.
            </span>
          </p>
        </div>

        {/* ── the actual product, as it is ──────────────────────────── */}
        <div className="animate-rise relative" style={{ animationDelay: "150ms" }}>
          <HeroStack words={DECK} />

          {/* The claim, sitting next to the thing that demonstrates it. */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-[440px]">
            <div className="rounded-mkt border border-graphite bg-carbon p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
              <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
                Top 100 words
              </p>
              <p className="mt-2 text-[26px] font-[590] leading-none tracking-[-0.03em] text-white tabular-nums">
                {HEADLINE_COVERAGE.percent}%
              </p>
              <p className="mt-1.5 text-[11.5px] leading-snug text-fog">
                of everything written, averaged over the {COUNTED_LANGUAGE_COUNT} languages with
                counted corpora
              </p>
            </div>
            <div className="rounded-mkt border border-graphite bg-carbon p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
              <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
                Languages
              </p>
              <p className="mt-2 text-[26px] font-[590] leading-none tracking-[-0.03em] text-white tabular-nums">
                {COVERAGE_LANGUAGE_COUNT}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-snug text-fog">
                each with 3,000 ranked words and audio
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
