import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GlyphTile } from "@/components/ui/GlyphTile";
import { COUNTED_LANGUAGE_COUNT, COVERAGE_LANGUAGE_COUNT, HEADLINE_COVERAGE } from "@/lib/corpus-facts";
import { LANGUAGES } from "@/lib/languages";

/**
 * The frame around the sign-in and create-account forms.
 *
 * ── Why it is a split ───────────────────────────────────────────────
 *
 * A centred form on an empty page is the default, and on a wide screen it is a
 * waste: the visitor has arrived from a landing page that just made a case, and
 * the half of the screen beside the form is the last chance to keep making it.
 * So at `lg` and up the left column carries the claim, a real measured number,
 * and the language tiles — all of it drawn from the same data as the landing
 * page, so the two cannot drift apart.
 *
 * On a phone the panel is dropped rather than stacked. A sign-up form that
 * requires scrolling past marketing before the first field is a form with a
 * worse conversion rate, and the visitor has just read that marketing anyway.
 *
 * The heading, the eyebrow and the footer link are props because the two pages
 * differ in all three and agree on everything else.
 */
export function AuthSplit({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-16 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-24 lg:px-10 lg:py-24">
      {/* ── the brand column (lg and up only) ─────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col lg:justify-center">
        <p className="max-w-[22ch] text-[clamp(1.6rem,2.4vw,2.1rem)] font-[510] leading-[1.2] tracking-[-0.025em] text-mist">
          The most common hundred words do half the work of the language.
        </p>

        <div className="mt-10 grid max-w-[420px] grid-cols-2 gap-3">
          <div className="rounded-mkt border border-graphite bg-carbon p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
            <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
              Top 100 words
            </p>
            <p className="mt-2 text-[28px] font-[590] leading-none tracking-[-0.03em] text-white tabular-nums">
              {HEADLINE_COVERAGE.percent}%
            </p>
            <p className="mt-1.5 text-[11.5px] leading-snug text-fog">
              of all text, averaged over {COUNTED_LANGUAGE_COUNT} languages
            </p>
          </div>
          <div className="rounded-mkt border border-graphite bg-carbon p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
            <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
              Ranked words
            </p>
            <p className="mt-2 text-[28px] font-[590] leading-none tracking-[-0.03em] text-white tabular-nums">
              3,000
            </p>
            <p className="mt-1.5 text-[11.5px] leading-snug text-fog">
              per language, ordered by real frequency
            </p>
          </div>
        </div>

        <ul className="mt-10 flex flex-wrap gap-2" aria-label="Available languages">
          {LANGUAGES.map((language) => (
            <li key={language.code}>
              <GlyphTile glyph={language.glyph} reading={language.glyphReading} size={40} />
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-[46ch] text-[13px] leading-relaxed text-fog">
          {COVERAGE_LANGUAGE_COUNT} languages, one method. Your progress is written to this device —
          there is no server account and nothing to sync.
        </p>
      </aside>

      {/* ── the form column ───────────────────────────────────────── */}
      <div className="flex flex-col justify-center">
        <div className="mx-auto w-full max-w-[420px] lg:mx-0">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-[13px] text-fog transition-colors duration-150 hover:text-bone lg:hidden"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            SabdhaSika
          </Link>

          <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">{eyebrow}</p>
          <h1 className="mt-4 text-[clamp(1.75rem,5vw,2.25rem)] font-[510] leading-[1.1] tracking-[-0.028em] text-mist">
            {title}
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-fog">{lede}</p>

          <div className="mt-9">{children}</div>
        </div>
      </div>
    </div>
  );
}
