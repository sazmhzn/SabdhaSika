import Link from "next/link";
import { Brain, ListOrdered, Languages } from "lucide-react";
import { marketingButtonClasses } from "@/components/ui/button-classes";
import { COVERAGE_MILESTONES, meanCoverage } from "@/lib/corpus-facts";

/**
 * How it works, and what the ladder looks like.
 *
 * Two sections that belong together: the first says what a session *is*, the
 * second says what the sequence *adds up to*. The numbers in the ladder are
 * the same measured means used in the evidence section, so a reader scrolling
 * from one to the other is looking at one dataset, not two.
 */
const STEPS = [
  {
    icon: Languages,
    title: "Choose a language",
    body: "Ten to pick from, each with a list ranked by real corpus frequency. Switch whenever you like — progress is kept per language, so nothing is lost by trying another.",
  },
  {
    icon: ListOrdered,
    title: "Meet twenty words",
    body: "A session mixes new words with the ones the scheduler says are due. Every card carries the word, its reading where the script needs one, and a sentence it actually appears in.",
  },
  {
    icon: Brain,
    title: "Say them back",
    body: "A recall drill asks you to produce the word from memory before showing it. Recognising a word is not the same as knowing it, and only one of those two is measured here.",
  },
] as const;

/** What each milestone is worth, in the same terms the evidence uses. */
const LADDER = [
  { n: 100, note: "The words that do the most work in the language. This is where comprehension starts to move." },
  { n: 250, note: "Enough to follow the shape of a simple sentence, even when you miss a word in it." },
  { n: 500, note: "Everyday written material becomes readable with effort rather than guesswork." },
  { n: 1000, note: "You stop translating word by word and start reading in phrases." },
  { n: 2000, note: "The long tail begins: rarer words, and much smaller gains per word learned." },
  { n: 3000, note: "The end of the list. Past this point, real texts teach faster than a ranked list can." },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 border-t border-graphite bg-void">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-20 lg:px-10 lg:py-24">
        <div className="max-w-[54ch]">
          <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
            How it works
          </p>
          <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.75rem)] font-[510] leading-[1.08] tracking-[-0.028em] text-white">
            A short session,
            <br />
            in the right order.
          </h2>
        </div>

        <ol className="mt-14 grid gap-4 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-mkt border border-graphite bg-carbon p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="grid size-10 place-items-center rounded-mkt-sm border border-graphite bg-obsidian text-fog">
                  <step.icon className="size-[18px]" strokeWidth={2} />
                </span>
                <span className="text-[22px] font-[510] leading-none text-ash tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-6 text-[17px] font-[510] tracking-[-0.015em] text-white">
                {step.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-fog">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Ladder() {
  return (
    <section id="ladder" className="scroll-mt-24 border-t border-graphite bg-void">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-20 lg:px-10 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-[54ch]">
            <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">
              The ladder
            </p>
            <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.75rem)] font-[510] leading-[1.08] tracking-[-0.028em] text-white">
              What each milestone
              <br />
              actually buys you.
            </h2>
            <p className="mt-6 text-[15.5px] leading-relaxed text-fog">
              The same six markers the app tracks, with the measured coverage behind each one. It is
              deliberately not a promise of fluency — it is a description of what the list is worth.
            </p>
          </div>
          <Link
            href="/register"
            className={marketingButtonClasses({ variant: "secondary", size: "md" })}
          >
            Start at word one
          </Link>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-mkt border border-graphite bg-graphite sm:grid-cols-2 lg:grid-cols-3">
          {LADDER.map((rung) => {
            const coverage = Math.round(meanCoverage(rung.n as (typeof COVERAGE_MILESTONES)[number]));
            return (
              <li key={rung.n} className="flex flex-col bg-carbon p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[30px] font-[590] leading-none tracking-[-0.03em] text-white tabular-nums">
                    {rung.n.toLocaleString()}
                  </span>
                  <span className="rounded-full border border-graphite bg-obsidian px-2.5 py-1 text-[11px] font-[510] text-fog tabular-nums">
                    ≈ {coverage}% of text
                  </span>
                </div>
                <div
                  className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-graphite"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-mist"
                    style={{ width: `${coverage}%` }}
                  />
                </div>
                <p className="mt-4 text-[13.5px] leading-relaxed text-fog">{rung.note}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
