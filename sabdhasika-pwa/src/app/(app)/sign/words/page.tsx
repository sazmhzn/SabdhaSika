"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/nav/AppShell";
import { ReferenceClip } from "@/components/sign/ReferenceClip";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { allPilotClips } from "@/lib/sign/word-clips";

const CLIPS = allPilotClips();

/**
 * Word signs — teach playback (pilot).
 *
 * Pick a word, watch the reference clip, copy it. Camera grading is not wired
 * yet: this page deliberately never touches progress, streak or the session,
 * so it cannot complete a day (see CONTEXT.md: only an empty queue is Day done).
 */
export default function SignWordsPage() {
  const [active, setActive] = useState(CLIPS[0]);

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader
        eyebrow="American Sign Language"
        title="Word signs"
        trailing={
          <span className="flex items-center gap-4">
            <Link href="/sign" className="press text-[12.5px] font-semibold text-muted hover:text-ink">
              Fingerspelling
            </Link>
            <Link href="/sign/practice" className="press text-[12.5px] font-semibold text-muted hover:text-ink">
              Practice
            </Link>
          </span>
        }
      />

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
        <div>
          {active && <ReferenceClip clip={active} />}
          <p className="mt-3 flex items-center gap-2 px-1 text-[11px] text-faint">
            <span className="size-1.5 rounded-full bg-good" />
            Local reference video. Nothing is uploaded.
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:mt-0">
          <section className="rounded-panel border border-line bg-paper pad-panel">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              Pilot words · {CLIPS.length}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CLIPS.map((clip) => (
                <button
                  key={clip.slug}
                  type="button"
                  onClick={() => setActive(clip)}
                  className={cn(
                    "press rounded-chip border px-3 py-2 text-[13px] font-semibold capitalize",
                    clip.slug === active?.slug
                      ? "border-transparent bg-ink text-paper"
                      : "border-line bg-surface text-ink-soft",
                  )}
                >
                  {clip.gloss}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-panel border border-line bg-paper pad-panel">
            <p className="text-[13.5px] font-semibold text-ink">How to use this</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Watch the clip for &ldquo;{active?.gloss}&rdquo;, copy the sign in a mirror, then say the word
              aloud. Camera grading arrives next — for now, fingerspelling practice is the graded drill.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/sign/words/test">
                <Button size="sm">Test me on these</Button>
              </Link>
              <Link href="/sign/practice">
                <Button size="sm" variant="secondary">
                  Go to fingerspelling practice
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
