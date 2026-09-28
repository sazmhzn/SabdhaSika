"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * The streak flame.
 *
 * It is the only place in the product that uses the accent colour, and it is
 * deliberately small: the spec is explicit that vocabulary mastery matters
 * more than streaks, so the flame is a warm detail in the corner of the
 * screen, never a headline.
 */
export function Flame({
  size = 16,
  active = true,
  className,
}: {
  size?: number;
  active?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      animate={reduce || !active ? undefined : { scale: [1, 1.07, 1], rotate: [-2, 2, -2] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <path
        d="M12 2.6c.5 2.4-.6 3.9-2 5.3-1.5 1.5-3.3 3.2-3.3 6.1a5.9 5.9 0 0 0 11.8.2c0-2-.9-3.4-1.9-4.6-.4.9-1 1.5-1.8 1.8.4-2.6-.3-6.1-2.8-8.8Z"
        fill={active ? "var(--accent)" : "var(--faint)"}
        opacity={active ? 1 : 0.6}
      />
      <path
        d="M12.1 12.2c.3 1.3-.4 2-.9 2.7-.6.7-1.1 1.4-1.1 2.4a2.9 2.9 0 0 0 5.8 0c0-1.4-1-2.4-1.9-3.4-.3.6-.8 1-1.3 1.2.2-1 0-2-.6-2.9Z"
        fill={active ? "var(--paper)" : "var(--paper)"}
        opacity={active ? 0.55 : 0.4}
      />
    </motion.svg>
  );
}

export function StreakChip({
  days,
  className,
  compact,
}: {
  days: number;
  className?: string;
  compact?: boolean;
}) {
  const active = days > 0;
  return (
    <span
      className={cn(
        /* nowrap matters: at 320px the flex header will otherwise squeeze this
           chip and wrap "day streak" onto two lines. */
        "chrome-noselect inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface font-semibold",
        compact ? "h-7 px-3 text-[12px]" : "h-9 px-4 text-[13px]",
        active ? "text-ink" : "text-muted",
        className,
      )}
      title={active ? `${days} day streak` : "No streak yet"}
    >
      <Flame size={compact ? 13 : 15} active={active} />
      {active ? (
        <>
          {days}
          <span className="font-medium text-muted">{compact ? "d" : "day streak"}</span>
        </>
      ) : (
        <span className="font-medium">Start a streak</span>
      )}
    </span>
  );
}
