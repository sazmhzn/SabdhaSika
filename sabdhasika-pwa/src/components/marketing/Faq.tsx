"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { COVERAGE_LANGUAGE_COUNT, COUNTED_LANGUAGE_COUNT } from "@/lib/corpus-facts";

/**
 * Frequently asked questions.
 *
 * ── The animation ──────────────────────────────────────────────────
 *
 * The open/close uses the Osmo "CSS accordion" technique: the answer panel is a
 * grid whose `grid-template-rows` animates between `0fr` and `1fr`, with an
 * `overflow:hidden` inner wrapper — which is the only height-animation that
 * works on unknown content without measuring it in JavaScript. The chevron is
 * rotated purely in CSS off the `data-accordion-status` attribute, so the
 * motion and the state live in one place. `close-siblings` is on, which is the
 * conventional behaviour for a FAQ: opening one answers means the others can
 * give way.
 *
 * ── Why this is now a state-driven wrapper, not native `<details>` ───
 *
 * The earlier version used `<details>` precisely because it works before
 * hydration and costs no JS. `<details>` cannot be height-animated: the browser
 * hides the body with `display:none`, so there is nothing to tween. The user
 * asked for this animation, which requires the body to stay in flow and be
 * clipped — so the disclosure moves to a button + `aria-expanded`, which keeps
 * it keyboard-operable and screen-reader correct, just not pre-hydration. The
 * trade is deliberate and local to this one section.
 */
const QUESTIONS = [
  {
    q: "Where is my progress actually stored?",
    a: "On this device, in your browser's IndexedDB. There is no account server, no analytics pipeline and no sync — the sign-in you create here is a local one, which is why the app keeps working with the network switched off. Clearing your browser's site data will clear your progress with it.",
  },
  {
    q: "Do I have to install it?",
    a: "No. It runs in the browser like any website. Installing it — from the browser's own install prompt, or Add to Home Screen — is what gets you offline use, a home-screen icon and no address bar. Both routes use the same data, so you can install later without losing anything.",
  },
  {
    q: "What does “frequency order” mean, exactly?",
    a: "Each language's list is ranked by how often the word actually occurs in a large corpus of real text. Rank 1 is the most common word in the language. Because the top hundred words cover roughly half of everything written, learning in rank order means every word you meet is worth more than the one after it.",
  },
  {
    q: "How many words is a session?",
    a: "You choose: 10, 20, 25 or 30 a day. The default is 20, which is about five minutes and is the point at which the daily habit survives a busy week. Words you have already met come back on a spaced-repetition schedule, so a session mixes new words with reviews.",
  },
  {
    q: "What happens if I miss a day?",
    a: "Nothing breaks. The streak resets to zero, and the words you were due simply stay due. They come back in your next session, and the scheduler re-spaces them rather than dumping the whole backlog on you at once.",
  },
  {
    q: "Why stop at 3,000 words?",
    a: "Diminishing returns. Going from the top 100 words to the top 3,000 roughly doubles your coverage — but the next 3,000 words would buy far less than that, while costing far more study. Past this point, reading real material teaches faster than a list can.",
  },
  {
    q: `Why do only ${COUNTED_LANGUAGE_COUNT} of the ${COVERAGE_LANGUAGE_COUNT} languages show a coverage percentage?`,
    a: "Because the other one's source publishes word ranks without occurrence counts, so there is no honest percentage to compute. Rather than estimate one, we show the rank and say nothing about coverage. Every figure on this site is measured from the same lists the app teaches from.",
  },
] as const;

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="questions" className="scroll-mt-24 border-t border-graphite bg-void">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-20 lg:px-10 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <div>
            <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">Questions</p>
            <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.75rem)] font-[510] leading-[1.08] tracking-[-0.028em] text-white">
              The things worth
              <br />
              asking first.
            </h2>
            <p className="mt-6 max-w-[40ch] text-[14.5px] leading-relaxed text-fog">
              Including the one about where your data goes, which we would rather answer plainly
              than leave to a privacy policy.
            </p>
          </div>

          <div
            data-accordion-css-init
            data-accordion-close-siblings="true"
            className="accordion-css flex flex-col"
          >
            {QUESTIONS.map((item, index) => {
              const active = openIndex === index;
              return (
                <div
                  key={item.q}
                  data-accordion-status={active ? "active" : "not-active"}
                  className="accordion-css__item border-b border-graphite"
                >
                  <button
                    type="button"
                    data-accordion-toggle
                    aria-expanded={active}
                    aria-controls={`faq-panel-${index}`}
                    onClick={() => setOpenIndex(active ? null : index)}
                    className="accordion-css__item-top flex w-full items-center justify-between gap-6 py-5 text-left"
                  >
                    <span className="text-[15px] font-[510] leading-snug tracking-[-0.01em] text-mist transition-colors duration-150 hover:text-white">
                      {item.q}
                    </span>
                    <span className="accordion-css__item-icon inline-grid size-5 shrink-0 place-items-center text-ash">
                      <ChevronDown className="size-4" strokeWidth={2} aria-hidden="true" />
                    </span>
                  </button>
                  <div id={`faq-panel-${index}`} className="accordion-css__item-bottom" role="region">
                    <div className="accordion-css__item-bottom-wrap">
                      <div className="accordion-css__item-bottom-content pb-6 pr-8">
                        <p className="text-[14px] leading-relaxed text-fog">{item.a}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
