"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { FingerExtension, Handshape } from "@/lib/data/asl";

/**
 * A schematic hand, drawn from a handshape description.
 *
 * This is a diagram, not a photograph of a signer, and it is labelled as one.
 * It is drawn from the same specification a dictionary would print — finger
 * extension and thumb placement — which keeps it honest and, unlike borrowed
 * video, entirely ours to ship.
 *
 * Proportioned loosely to a right hand seen from the back, fingers up.
 */

const FINGER_WIDTH: Record<keyof FingerExtension, number> = {
  thumb: 15,
  index: 19,
  middle: 20,
  ring: 18,
  pinky: 15,
};

interface Props {
  handshape: Handshape;
  /** Draws on mount — used for the card hero. */
  animate?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function HandShapeDiagram({ handshape, animate = false, size = "md", className }: Props) {
  const reduce = useReducedMotion();
  const box = size === "lg" ? 200 : size === "sm" ? 96 : 140;
  const scale = box / 200;
  const h = handshape.hand;
  const rotation = handshape.rotation ?? 0;

  // Fingers fanned left-to-right; the thumb is drawn separately because its
  // placement is what distinguishes most letters.
  const fingers = [
    { key: "index" as const, x: 62 },
    { key: "middle" as const, x: 96 },
    { key: "ring" as const, x: 130 },
    { key: "pinky" as const, x: 160 },
  ];

  const length = (ext: number) => 20 + ext * 78;
  const thumbPath = thumbGeometry(handshape.thumb, h.thumb);

  return (
    <svg
      viewBox="0 0 200 200"
      width={box}
      height={box}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`Schematic diagram of the ${handshape.symbol} handshape: ${handshape.cue}`}
    >
      {/* Palm */}
      <motion.rect
        x={54}
        y={96}
        width={104}
        height={78}
        rx={30}
        fill="var(--tile-top)"
        stroke="var(--ink)"
        strokeOpacity={0.28}
        strokeWidth={2.5}
        initial={animate && !reduce ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      />

      {fingers.map((f) => {
        const ext = h[f.key];
        const w = FINGER_WIDTH[f.key];
        const len = length(ext);
        return (
          <motion.rect
            key={f.key}
            x={f.x - w / 2}
            y={104 - len}
            width={w}
            height={len + 20}
            rx={w / 2}
            fill="var(--tile-top)"
            stroke="var(--ink)"
            strokeOpacity={0.28}
            strokeWidth={2.5}
            initial={animate && !reduce ? { scaleY: 0.2, opacity: 0.3 } : false}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.42, delay: 0.05 * fingers.indexOf(f) }}
            style={{ transformOrigin: `${f.x}px 110px`, rotate: rotation ? `${rotation}deg` : undefined }}
          />
        );
      })}

      {/* Knuckle line, so the hand reads as a hand and not as a comb. */}
      <path
        d="M56 118 Q106 104 156 118"
        fill="none"
        stroke="var(--ink)"
        strokeOpacity={0.16}
        strokeWidth={2}
      />

      {/* Thumb */}
      <motion.path
        d={thumbPath.d}
        fill="var(--tile-top)"
        stroke="var(--ink)"
        strokeOpacity={0.28}
        strokeWidth={2.5}
        strokeLinejoin="round"
        initial={animate && !reduce ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.12 }}
      />

      {/* Movement letters trace their path, which is part of the letter. */}
      {handshape.symbol === "J" && (
        <motion.path
          d="M74 40 Q74 78 96 88"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={4}
          strokeLinecap="round"
          initial={animate && !reduce ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: 0.3 }}
        />
      )}
      {handshape.symbol === "Z" && (
        <motion.path
          d="M70 34 L118 34 L70 66 L118 66"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={animate && !reduce ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: 0.3 }}
        />
      )}
    </svg>
  );
}

/**
 * Thumb geometry per placement.
 *
 * Each is the position that actually distinguishes the letters — B's thumb
 * across the palm, Y's out to the side, K's between the fingers — so this is
 * where the meaning of a handshape mostly lives.
 */
function thumbGeometry(placement: Handshape["thumb"], extension: number): { d: string } {
  const out = 30 + extension * 26;

  switch (placement) {
    case "across-palm":
      return { d: `M60 150 Q60 172 ${60 + out} 172 L${60 + out} 150 Z` };
    case "out-to-side":
      return { d: `M58 140 Q${58 - out * 0.9} 132 ${58 - out} 108 Q${58 - out - 14} 104 ${58 - out} 120 Q${58 - out * 0.7} 140 66 156 Z` };
    case "alongside-index":
      return { d: `M62 148 Q44 140 42 ${110 + (1 - extension) * 26} Q42 102 54 104 Q62 106 64 128 Z` };
    case "touching-middle":
      return { d: `M60 146 Q40 138 46 112 Q52 100 66 108 Q72 116 68 140 Z` };
    case "between":
      return { d: `M58 146 Q52 108 76 88 Q88 80 94 92 Q98 104 84 112 Q68 124 68 150 Z` };
    case "in-fist":
      return { d: `M64 152 Q50 130 66 118 Q82 108 88 122 Q92 134 78 152 Z` };
    default:
      return { d: "M60 150 Q60 172 84 172 L84 150 Z" };
  }
}