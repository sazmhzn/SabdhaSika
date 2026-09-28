"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  /** Draws tick marks every `segments` for a "list of words" feel. */
  segments?: number;
  tone?: "ink" | "accent";
  height?: number;
  label?: string;
}

export function ProgressBar({
  value,
  max = 100,
  className,
  segments,
  tone = "ink",
  height = 8,
  label,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-full bg-surface-2", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <motion.div
        className={cn("h-full rounded-full", tone === "ink" ? "bg-ink" : "bg-accent")}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 220, damping: 30, mass: 0.6 }}
      />
      {segments ? (
        <div
          className="pointer-events-none absolute inset-0 flex"
          aria-hidden="true"
        >
          {Array.from({ length: segments - 1 }).map((_, i) => (
            <span
              key={i}
              className="h-full bg-paper/55"
              style={{ width: 1, marginLeft: `${100 / segments}%`, transform: "translateX(-1px)" }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A ring progress indicator — used for the daily goal on the home screen. */
export function ProgressRing({
  value,
  max,
  size = 72,
  stroke = 7,
  children,
  tone = "ink",
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  tone?: "ink" | "accent";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-2"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={tone === "ink" ? "stroke-ink" : "stroke-accent"}
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: "spring", stiffness: 180, damping: 26 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
