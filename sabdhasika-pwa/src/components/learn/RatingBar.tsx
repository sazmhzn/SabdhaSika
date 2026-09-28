"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Kbd } from "@/components/ui/Kbd";
import type { Rating } from "@/lib/types";

const OPTIONS: {
  value: Rating;
  emoji: string;
  label: string;
  key: string;
  hint: string;
}[] = [
  { value: "hard", emoji: "😵", label: "Hard", key: "1", hint: "Show it again today" },
  { value: "good", emoji: "🙂", label: "Good", key: "2", hint: "Back in a few days" },
  { value: "easy", emoji: "😎", label: "Easy", key: "3", hint: "I know this one" },
];

export interface RatingBarProps {
  onRate: (rating: Rating) => void;
  /** Subtly marks the rating the answer implies. Never auto-submits. */
  suggested?: Rating | null;
  showHints?: boolean;
  className?: string;
}

/**
 * Self-assessment.
 *
 * The wording is a question about *memory*, not a grading scale — "How well
 * did you remember?" rather than "Rate your confidence 1–5". Three options,
 * one tap, no slider. The spec is explicit that this must not feel like a
 * productivity tool, so there is no "again / hard / good / easy / very easy"
 * ladder and no interval preview.
 */
export function RatingBar({ onRate, suggested, showHints, className }: RatingBarProps) {
  return (
    <div className={cn("w-full", className)}>
      <p className="mb-3 text-center text-[12px] font-medium text-muted">
        How well did you remember?
      </p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="How well did you remember?">
        {OPTIONS.map((opt, i) => {
          const isSuggested = suggested === opt.value;
          return (
            <motion.button
              key={opt.value}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.045, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onRate(opt.value)}
              aria-label={`${opt.label} — ${opt.hint}`}
              className={cn(
                "press chrome-noselect group relative flex flex-col items-center gap-1 rounded-row border py-3",
                opt.value === "good"
                  ? "border-transparent bg-ink text-paper"
                  : "border-line bg-surface text-ink hover:bg-surface-2",
                isSuggested && opt.value !== "good" && "ring-2 ring-ink/25",
                isSuggested && opt.value === "good" && "ring-2 ring-paper/40",
              )}
            >
              <span className="text-[20px] leading-none" aria-hidden="true">
                {opt.emoji}
              </span>
              <span className="text-[13px] font-semibold">{opt.label}</span>
              {showHints && (
                <Kbd
                  className={cn(
                    "mt-1 border-transparent",
                    opt.value === "good" ? "bg-paper/15 text-paper/70" : "",
                  )}
                >
                  {opt.key}
                </Kbd>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export const RATING_FROM_KEY: Record<string, Rating> = {
  "1": "hard",
  "2": "good",
  "3": "easy",
};

export const RATING_ORDER: Rating[] = ["hard", "good", "easy"];
