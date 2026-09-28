"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";

export interface ConfettiProps {
  /** Bump this to fire a fresh burst. */
  fireKey: number | string;
  pieces?: number;
  className?: string;
  /** "burst" spreads outward, "rain" falls from the top. */
  mode?: "burst" | "rain";
}

const PALETTE = [
  "var(--ink)",
  "var(--ink-soft)",
  "var(--accent)",
  "var(--muted)",
  "var(--ink)",
  "var(--accent)",
];

/**
 * Confetti without a canvas and without a dependency: 44 absolutely
 * positioned spans, one CSS keyframe, seeded so a given burst is stable.
 *
 * Deliberately not on every completion — a burst that happens every single
 * day stops meaning anything. This fires for milestones, and the lighter
 * "settle" animation carries the daily finish.
 */
export function Confetti({ fireKey, pieces = 44, className, mode = "burst" }: ConfettiProps) {
  const items = useMemo(() => {
    const seed = typeof fireKey === "number" ? fireKey : fireKey.length * 7919;
    let s = seed || 1;
    const rand = () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
    return Array.from({ length: pieces }, (_, i) => {
      const angle = (i / pieces) * Math.PI * 2 + rand() * 0.6;
      const distance = 90 + rand() * 170;
      const dx = mode === "rain" ? (rand() - 0.5) * 320 : Math.cos(angle) * distance;
      const dy = mode === "rain" ? 300 + rand() * 160 : Math.sin(angle) * distance - 40;
      return {
        id: `${fireKey}-${i}`,
        left: mode === "rain" ? rand() * 100 : 50 + (rand() - 0.5) * 22,
        top: mode === "rain" ? -8 : 46,
        dx,
        dy,
        rot: (rand() - 0.5) * 720,
        delay: rand() * 0.22,
        duration: 1.1 + rand() * 0.9,
        size: 5 + rand() * 6,
        radius: rand() > 0.6 ? "9999px" : "2px",
        color: PALETTE[Math.floor(rand() * PALETTE.length)],
      };
    });
  }, [fireKey, pieces, mode]);

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      {items.map((p) => (
        <span
          key={p.id}
          className="reduce-hide absolute"
          style={
            {
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size * (p.radius === "2px" ? 1.7 : 1),
              background: p.color,
              borderRadius: p.radius,
              animation: `confetti-fall ${p.duration}s cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}s both`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
