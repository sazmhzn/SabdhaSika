import type { Metadata } from "next";
import { Benefits } from "@/components/marketing/Benefits";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { CoverageEvidence } from "@/components/marketing/CoverageEvidence";
import { Faq } from "@/components/marketing/Faq";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks, Ladder } from "@/components/marketing/HowItWorks";
import { LanguageGrid } from "@/components/marketing/LanguageGrid";
import { COVERAGE_LANGUAGE_COUNT, HEADLINE_COVERAGE } from "@/lib/corpus-facts";

/**
 * The landing page.
 *
 * ── The order, and why ──────────────────────────────────────────────
 *
 * Purpose, then proof, then method. A visitor arrives not knowing what this is,
 * so the hero says it in one sentence and shows the product doing it. Then the
 * two questions a careful reader asks, in the order they ask them: *is this
 * claim true?* (the evidence section, which is measured data rather than
 * assertion) and *what would I actually be doing?* (the method and the ladder).
 * Languages and questions follow, and the closing block asks for the sign-up
 * once the case has been made rather than before it.
 *
 * ── Why it is a server component ────────────────────────────────────
 *
 * Everything on this page except the nav and the closing call to action is
 * static. The numbers come from `@/lib/corpus-facts`, the demo word from the
 * shipped dataset, the FAQ from `<details>`, the entrance from a CSS animation.
 * So the page ships as HTML and paints in the first frame — which matters more
 * here than anywhere else in the product, because this is the one screen a
 * visitor sees before deciding whether to wait.
 */
export const metadata: Metadata = {
  title: "Learn the words that actually carry the language",
  description: `A daily vocabulary ritual built on real corpus frequency. ${COVERAGE_LANGUAGE_COUNT} languages, 3,000 ranked words each — the top 100 words cover ${HEADLINE_COVERAGE.percent}% of everything written. Free, offline-first, and stored on your device.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: "SabdhaSika — learn the words that actually carry the language",
    description: `The top 100 words cover ${HEADLINE_COVERAGE.percent}% of everything written. Learn them in rank order, twenty a day.`,
    type: "website",
    siteName: "SabdhaSika",
  },
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Benefits />
      <CoverageEvidence />
      <HowItWorks />
      <Ladder />
      <LanguageGrid />
      <Faq />
      <ClosingCta />
    </>
  );
}
