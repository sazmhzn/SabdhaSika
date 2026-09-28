import { GlyphTile } from "@/components/ui/GlyphTile";
import { COVERAGE_BY_LANGUAGE, COVERAGE_LANGUAGE_COUNT } from "@/lib/corpus-facts";
import { LANGUAGES } from "@/lib/languages";

/**
 * The language grid.
 *
 * Every entry shows the real size of its shipped list, read from the generated
 * frequency manifest rather than typed here — and where a language publishes no
 * token counts (Japanese), it says so instead of showing a percentage. A grid
 * of identical-looking tiles with invented precision would be the easiest thing
 * on this page to fake, so it is the one that is wired to the data.
 *
 * ── Hover is a border, not a lift ───────────────────────────────────
 *
 * The app's language tiles rise on hover, which is right on a phone where the
 * tile is the target. Here they step one rung up the surface ladder instead and
 * the hairline brightens. Nothing moves, because nothing here is being pressed.
 */
export function LanguageGrid() {
  return (
    <section id="languages" className="scroll-mt-24 border-t border-graphite bg-void">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-20 lg:px-10 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[54ch]">
            <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
              Languages
            </p>
            <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.75rem)] font-[510] leading-[1.08] tracking-[-0.028em] text-white">
              {COVERAGE_LANGUAGE_COUNT} languages, one method.
            </h2>
            <p className="mt-6 text-[15.5px] leading-relaxed text-fog">
              Each list is ranked by real corpus frequency and capped at 3,000 words — past that
              point a word earns its place less and less often. Scripts that need a reading layer
              get one; Latin-script languages skip it.
            </p>
          </div>
          <p className="text-[12.5px] text-ash">
            Switch languages any time. Your progress is kept per language.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {LANGUAGES.map((language) => {
            const counted = COVERAGE_BY_LANGUAGE[language.code];
            const top100 = counted?.coverage[100];
            return (
              <li
                key={language.code}
                className="flex items-center gap-4 rounded-mkt border border-graphite bg-carbon p-4 transition-colors duration-200 hover:border-smoke hover:bg-obsidian"
              >
                <GlyphTile glyph={language.glyph} reading={language.glyphReading} size={48} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-[510] tracking-[-0.01em] text-mist">
                    {language.name}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-fog">{language.nativeName}</p>
                  <p className="mt-1.5 text-[11px] text-ash tabular-nums">
                    {typeof top100 === "number"
                      ? `top 100 = ${Math.round(top100)}% of text`
                      : `${language.frequencyListSize.toLocaleString()} ranked words`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
