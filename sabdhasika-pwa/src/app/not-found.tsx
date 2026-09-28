import Link from "next/link";
import { GlyphTile } from "@/components/ui/GlyphTile";

/**
 * 404 copy in the product's voice: a word that is not in the frequency list.
 * Friendly, brief, and it always offers the one useful next step.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
      <GlyphTile glyph="?" reading="unknown" size={92} />
      <h1 className="mt-7 text-[22px] font-extrabold tracking-[-0.02em] text-ink">
        This page isn&rsquo;t in the list
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Not every word makes the top 3,000. Let&rsquo;s get back to the ones that do.
      </p>
      <Link
        href="/learn"
        className="press mt-6 inline-flex h-12 items-center rounded-row bg-ink px-6 text-[14px] font-semibold text-paper"
      >
        Back to today&rsquo;s words
      </Link>
    </main>
  );
}
