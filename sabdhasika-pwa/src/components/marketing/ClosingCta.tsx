"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FrequencyField } from "@/components/marketing/FrequencyField";
import { PrimaryCta } from "@/components/marketing/PrimaryCta";
import { marketingButtonClasses } from "@/components/ui/button-classes";
import { useAccountStore } from "@/lib/account-store";
import {
  COUNTED_LANGUAGE_COUNT,
  COVERAGE_LANGUAGE_COUNT,
  HEADLINE_COVERAGE,
} from "@/lib/corpus-facts";

/**
 * The closing call to action.
 *
 * ── The shader ──────────────────────────────────────────────────────
 *
 * This is the one place on the site where the design language allows a
 * decorative surface, and it earns it: the field behind this text is the Zipf
 * curve the whole product is built on, drawn as light. It is the last thing a
 * visitor sees and the only thing on the page that moves — which is why it is
 * here and nowhere else. See `FrequencyField`.
 *
 * The card is deliberately tall. The field puts its light in the lower third,
 * so the headline and the buttons sit over the dark upper two-thirds and the
 * ridge is visible beneath them rather than behind them. A shorter card would
 * put the brightest part of the shader directly under the type.
 *
 * ── Why it is a client component ────────────────────────────────────
 *
 * It has to know whether there is already a session: someone who is signed in
 * and has scrolled to the bottom should be offered the app, not a registration
 * form. That state is only knowable in the browser. It costs nothing extra,
 * because the marketing nav already reads the same store.
 */
export function ClosingCta() {
  const session = useAccountStore((s) => s.session);
  const hydrated = useAccountStore((s) => s.hydrated);
  const signedIn = hydrated && Boolean(session);

  return (
    <section className="border-t border-graphite bg-void">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 lg:px-10 lg:py-28">
        <div className="relative isolate overflow-hidden rounded-mkt border border-graphite bg-carbon">
          <FrequencyField className="pointer-events-none absolute inset-0" />

          <div className="relative px-6 py-24 text-center lg:px-16 lg:py-32">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ash">
              {signedIn ? "You're already set up" : "Start today"}
            </p>

            <h2 className="mx-auto mt-6 max-w-[24ch] text-[clamp(1.9rem,4.4vw,3.25rem)] font-[510] leading-[1.05] tracking-[-0.025em] text-white">
              {signedIn ? (
                <>Your list is waiting.</>
              ) : (
                <>
                  Twenty words today.
                  <br />
                  {HEADLINE_COVERAGE.percent}% of the language soon.
                </>
              )}
            </h2>

            <p className="mx-auto mt-7 max-w-[52ch] text-[15.5px] leading-relaxed text-fog">
              {signedIn
                ? "Today's words are already chosen. Pick up where you left off — it takes about five minutes."
                : `Free, and it stays on your device. ${COVERAGE_LANGUAGE_COUNT} languages ranked by real corpus frequency, ${COUNTED_LANGUAGE_COUNT} of them with measured coverage.`}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {signedIn ? (
                <PrimaryCta
                  href="/learn"
                  size="lg"
                  label="Open the app"
                  icon={<ArrowRight className="size-4" strokeWidth={2} />}
                />
              ) : (
                <>
                  <PrimaryCta
                    href="/register"
                    size="lg"
                    label="Create an account"
                    icon={<ArrowRight className="size-4" strokeWidth={2} />}
                  />
                  <Link
                    href="/signin"
                    className={marketingButtonClasses({ variant: "secondary", size: "lg" })}
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>

            {!signedIn && (
              <p className="mt-7 text-[12.5px] text-ash">
                No card, no email confirmation, no server. Creating an account takes one field.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
