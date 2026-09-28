import Link from "next/link";
import { GlyphTile } from "@/components/ui/GlyphTile";
import { COUNTED_LANGUAGE_COUNT, COVERAGE_LANGUAGE_COUNT } from "@/lib/corpus-facts";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "#how", label: "How it works" },
      { href: "#ladder", label: "The frequency ladder" },
      { href: "#languages", label: "Languages" },
      { href: "#questions", label: "Questions" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/register", label: "Create an account" },
      { href: "/signin", label: "Sign in" },
      { href: "/learn", label: "Open the app" },
    ],
  },
];

/**
 * The footer carries the corpus attribution, which is not decoration.
 *
 * Every frequency list in this product is real third-party data: nine languages
 * come from `hermitdave/FrequencyWords` under CC BY-SA 4.0, and Japanese comes
 * from `wordfreq`. CC BY-SA requires attribution, and a product whose entire
 * pitch is "these are the words that matter, and here is the evidence" has no
 * business hiding where the evidence came from. So the sources, their licences
 * and their links are stated plainly rather than buried in a README.
 *
 * ── The one surface that steps up ───────────────────────────────────
 *
 * The page is `void` throughout and this is `carbon` — one step up the surface
 * ladder, separated by the same graphite hairline every other block uses. It is
 * the only place the page closes over rather than continuing, which is what a
 * footer is for, and it does it without a shadow or a colour change.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-graphite bg-carbon">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-16 lg:px-10 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1.7fr] lg:gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <GlyphTile glyph="श" reading="śa" size={30} />
              <span className="text-[15px] font-[590] tracking-[-0.02em] text-white">
                SabdhaSika
              </span>
            </div>
            <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-fog">
              A daily vocabulary ritual built on real corpus frequency. {COVERAGE_LANGUAGE_COUNT}{" "}
              languages, 3,000 ranked words each.
            </p>
            <p className="mt-4 text-[13px] text-ash">
              śabda — Sanskrit, &ldquo;word&rdquo;.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
                {column.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-fog transition-colors duration-150 hover:text-bone"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
              The data
            </h2>
            <p className="mt-4 text-[12.5px] leading-relaxed text-fog">
              Frequency lists for {COUNTED_LANGUAGE_COUNT} of the {COVERAGE_LANGUAGE_COUNT}{" "}
              languages are counted from{" "}
              <a
                href="https://github.com/hermitdave/FrequencyWords"
                target="_blank"
                rel="noreferrer noopener"
                className="text-mist underline decoration-graphite underline-offset-2 transition-colors hover:decoration-smoke"
              >
                hermitdave/FrequencyWords
              </a>{" "}
              (2018, OpenSubtitles), licensed CC BY-SA 4.0. Japanese comes from{" "}
              <a
                href="https://github.com/rspeer/wordfreq"
                target="_blank"
                rel="noreferrer noopener"
                className="text-mist underline decoration-graphite underline-offset-2 transition-colors hover:decoration-smoke"
              >
                wordfreq
              </a>
              , which publishes ranks and no counts — so no coverage percentage is shown for it.
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-graphite pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-ash">
            © {new Date().getFullYear()} SabdhaSika. Your progress is stored on your device.
          </p>
          <p className="text-[12px] text-ash">
            Built as a PWA — install it from your browser, then it works offline.
          </p>
        </div>
      </div>
    </footer>
  );
}
