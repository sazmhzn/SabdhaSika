"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { WordClip } from "@/lib/sign/word-clips";

interface ReferenceClipProps {
  clip: WordClip;
  className?: string;
}

/**
 * Reference sign player (teach playback).
 *
 * A plain `<video>` over the local clip — no ML, no grading. Missing files
 * (fresh clone without `node scripts/build-sl-index.mjs`) render a cue to run
 * the script rather than a broken player.
 */
export function ReferenceClip({ clip, className }: ReferenceClipProps) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div
        className={cn(
          "grid aspect-[4/3] w-full place-items-center rounded-panel border border-line bg-surface p-6 text-center",
          className,
        )}
      >
        <p className="max-w-xs text-[12.5px] leading-relaxed text-muted">
          No reference clip for &ldquo;{clip.gloss}&rdquo; yet. Run{" "}
          <code className="rounded bg-paper px-1.5 py-0.5 text-[12px]">node scripts/build-sl-index.mjs</code>{" "}
          with <code className="rounded bg-paper px-1.5 py-0.5 text-[12px]">SL/</code> at the repo root.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-panel border border-line bg-black", className)}>
      <video
        key={clip.src}
        src={clip.src}
        controls
        playsInline
        preload="metadata"
        onError={() => setMissing(true)}
        className="aspect-[4/3] w-full object-contain"
        aria-label={`Reference sign for ${clip.gloss}`}
      />
      <p className="bg-paper px-4 py-2 text-[11px] leading-relaxed text-faint">
        Reference sign — local dataset clip, licence unverified. Watch and copy; camera grading arrives next.
      </p>
    </div>
  );
}
