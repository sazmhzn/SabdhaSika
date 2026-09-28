"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Confetti } from "@/components/celebrate/Confetti";
import { Flame } from "@/components/celebrate/Flame";
import { Button } from "@/components/ui/Button";
import { sfx } from "@/lib/audio";
import { useCountUp } from "@/lib/hooks";
import { track } from "@/lib/metrics";
import { useStore } from "@/lib/store";

export interface SessionCompleteProps {
  wordsDone: number;
  newCount: number;
  reviewCount: number;
  wordsBefore: number;
  wordsAfter: number;
  /** Fires the confetti — only for milestones, so it stays meaningful. */
  celebrate?: boolean;
  onDone: () => void;
}

/**
 * Session complete.
 *
 * The moment the product has to earn. Three deliberate choices:
 *
 *  · **Numbers move.** The vocabulary counter counts up from where it was, so
 *    the session's effect is watched rather than read. This is the single
 *    cheapest piece of delight in the app and the one people screenshot.
 *  · **No confetti by default.** A burst after every single session becomes
 *    wallpaper by day four. The daily finish gets a quiet, precise settle; the
 *    confetti is reserved for frequency milestones.
 *  · **One primary action.** "Done" is the exit; "See progress" is the
 *    invitation. Nothing else competes.
 */
export function SessionComplete({
  wordsDone,
  newCount,
  reviewCount,
  wordsBefore,
  wordsAfter,
  celebrate,
  onDone,
}: SessionCompleteProps) {
  const streak = useStore((s) => s.state.streak.current);
  const counted = useCountUp(wordsAfter, 900);
  const streakCounted = useCountUp(streak, 700);
  const gained = wordsAfter - wordsBefore;

  useEffect(() => {
    sfx.complete();
    track("session_complete", { viewed: true, words: wordsDone });
  }, [wordsDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex min-h-svh flex-col items-center justify-center px-6 pb-safe pt-safe"
    >
      {celebrate && <Confetti fireKey={wordsAfter} pieces={54} />}

      <div className="w-full max-w-sm">
        {/* mark */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="mx-auto grid size-20 place-items-center rounded-card bg-ink"
        >
          <motion.svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <motion.path
              d="M4.5 12.6 9.4 17.5 19.5 6.8"
              stroke="var(--paper)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.18, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            />
          </motion.svg>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 text-center text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-ink"
        >
          Today&rsquo;s session
          <br />
          complete
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24 }}
          className="mt-2 text-center text-[14px] text-muted"
        >
          <span className="font-semibold text-ink tabular-nums">{wordsDone}</span> words
          <span className="mx-2 text-faint">·</span>
          <span className="tabular-nums">{newCount}</span> new
          <span className="mx-2 text-faint">·</span>
          <span className="tabular-nums">{reviewCount}</span> reviewed
        </motion.p>

        {/* The two numbers that matter.
            These are hand-rolled cards — `rounded-panel` + `bg-surface` +
            hairline, the same visual species as `.surface-card` — so they carry
            `grain` directly rather than through the primitive. Leaving them
            flat would put a matte panel next to seven grained ones. */}
        <div className="mt-7 grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.36 }}
            className="rounded-panel border border-line bg-surface grain relative isolate overflow-hidden p-4"
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">
              Vocabulary
            </p>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
                {counted}
              </span>
              {gained > 0 && (
                <span className="text-[12px] font-bold text-good tabular-nums">+{gained}</span>
              )}
            </p>
            <p className="mt-1 text-[11px] text-muted tabular-nums">was {wordsBefore}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.36 }}
            className="rounded-panel border border-line bg-surface grain relative isolate overflow-hidden p-4"
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">
              Streak
            </p>
            <p className="mt-2 flex items-center gap-2">
              <Flame size={20} />
              <span className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
                {streakCounted}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {streak === 1 ? "day — a start" : "days in a row"}
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.46, duration: 0.36 }}
          className="mt-6 flex flex-col gap-3"
        >
          <Link href="/progress" className="block">
            <Button size="lg" full>
              View progress
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </Button>
          </Link>
          <Button size="lg" variant="secondary" full onClick={onDone}>
            <Check className="size-4" strokeWidth={2.4} />
            Done
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-center text-[12px] text-faint"
        >
          Tomorrow&rsquo;s words are already picked.
        </motion.p>
      </div>
    </motion.div>
  );
}
