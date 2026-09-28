import type { Metadata } from "next";
import Link from "next/link";
import { GlyphTile } from "@/components/ui/GlyphTile";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
      <GlyphTile glyph="श" reading="śa" size={92} />
      <h1 className="mt-7 text-[22px] font-extrabold tracking-[-0.02em] text-ink">
        You&rsquo;re offline
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Today&rsquo;s words are saved on this device. Open the app again and the session will pick
        up exactly where you stopped.
      </p>
      <Link
        href="/session"
        className="press mt-6 inline-flex h-12 items-center rounded-row bg-ink px-6 text-[14px] font-semibold text-paper"
      >
        Resume today&rsquo;s words
      </Link>
    </main>
  );
}
