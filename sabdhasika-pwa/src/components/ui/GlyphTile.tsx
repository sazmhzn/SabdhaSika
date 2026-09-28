"use client";

import { cn } from "@/lib/cn";

/**
 * The signature element of the visual language: a rounded square with a soft
 * vertical gradient, the glyph centred, an optional romanization label inside
 * the bottom edge, and an optional corner badge.
 *
 * It is the smallest possible unit of "you are learning a script", and it
 * appears in onboarding, the language picker, the frequency journey and the
 * session summary — which is what makes the product feel like one thing.
 */
export interface GlyphTileProps {
  glyph: string;
  /** Small label inside the tile, under the glyph. */
  reading?: string;
  /** Corner marker, e.g. "M" for marker, "R" for radical. */
  badge?: string;
  size?: number;
  className?: string;
  /** Scales type down for long glyphs like Devanagari syllables. */
  dense?: boolean;
}

export function GlyphTile({
  glyph,
  reading,
  badge,
  size = 96,
  className,
  dense,
}: GlyphTileProps) {
  const glyphSize = size * (dense ? 0.34 : glyph.length > 1 ? 0.4 : 0.52);
  const labelSize = Math.max(9, size * 0.13);
  const badgeSize = Math.max(8, size * 0.12);

  return (
    <div
      className={cn("glyph-tile shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="font-semibold leading-none text-ink"
        style={{
          fontSize: glyphSize,
          marginBottom: reading ? size * 0.14 : 0,
          letterSpacing: "-0.02em",
        }}
      >
        {glyph}
      </span>
      {reading && (
        <span
          className="absolute inset-x-0 bottom-[9%] text-center font-medium text-ink/60"
          style={{ fontSize: labelSize }}
        >
          {reading}
        </span>
      )}
      {badge && (
        <span
          className="absolute right-[9%] top-[8%] font-semibold uppercase text-ink/35"
          style={{ fontSize: badgeSize, letterSpacing: "0.04em" }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
