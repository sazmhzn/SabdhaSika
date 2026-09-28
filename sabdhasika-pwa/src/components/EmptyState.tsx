"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Empty states here are teaching moments, not blank pages. Every one answers
 * three questions: what will be here, why it matters, and what to do now.
 */
export interface EmptyStateProps {
  /** A glyph, not a generic icon — it keeps the script on screen. */
  glyph: string;
  reading?: string;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  glyph,
  reading,
  title,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex flex-col items-center px-6 py-14 text-center", className)}
    >
      <div className="glyph-tile size-24" aria-hidden="true">
        <span className="text-4xl font-semibold leading-none text-ink/25">{glyph}</span>
        {reading && (
          <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-medium text-ink/25">
            {reading}
          </span>
        )}
      </div>
      <h3 className="mt-6 text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
