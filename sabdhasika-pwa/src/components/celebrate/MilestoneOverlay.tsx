"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Confetti } from "@/components/celebrate/Confetti";
import { GlyphTile } from "@/components/ui/GlyphTile";
import { Button } from "@/components/ui/Button";
import { sfx } from "@/lib/audio";
import { FREQUENCY_MILESTONES } from "@/lib/languages";
import { haptics } from "@/lib/haptics";
import { useStore } from "@/lib/store";

/**
 * Frequency milestones.
 *
 * This is the product's primary motivational mechanism (per the spec): the
 * feeling of progressively unlocking a language. So the celebration is
 * allowed to be bigger than the daily finish — full-screen, with confetti —
 * but it is *rare*, and the copy always names the number, because the number
 * is the achievement.
 */
export function MilestoneOverlay({
  milestone,
  onDismiss,
}: {
  milestone: number | null;
  onDismiss: () => void;
}) {
  const hapticsEnabled = useStore((s) => s.state.settings.hapticsEnabled);
  const markSeen = useStore((s) => s.markMilestoneSeen);

  useEffect(() => {
    if (milestone === null) return;
    haptics.milestone(hapticsEnabled);
    sfx.milestone();
    markSeen(milestone);
  }, [hapticsEnabled, markSeen, milestone]);

  const next = FREQUENCY_MILESTONES.find((m) => m > (milestone ?? 0));

  return (
    <AnimatePresence>
      {milestone !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-paper px-6 pb-safe pt-safe"
          role="dialog"
          aria-modal="true"
          aria-label={`${milestone} words learned`}
        >
          <Confetti fireKey={`m-${milestone}`} pieces={72} mode="rain" />

          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 20, delay: 0.08 }}
          >
            <GlyphTile glyph="श" reading="śa" badge="✓" size={104} />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 text-[11px] font-bold uppercase tracking-[0.22em] text-accent"
          >
            Milestone
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 text-center text-[clamp(2.6rem,13vw,4rem)] font-extrabold leading-[0.95] tracking-[-0.05em] text-ink tabular-nums"
          >
            {milestone.toLocaleString()}
            <span className="block text-[0.32em] font-bold tracking-[-0.01em] text-muted">
              WORDS
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-5 max-w-xs text-center text-[14.5px] leading-relaxed text-muted"
          >
            You&rsquo;ve learned {milestone.toLocaleString()} of the most frequent words. That is a
            real slice of the language.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 w-full max-w-xs"
          >
            <Button size="lg" full onClick={onDismiss}>
              Keep going
            </Button>
            {next && (
              <p className="mt-3 text-center text-[12px] text-faint tabular-nums">
                Next stop: {next.toLocaleString()} words
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Which milestone, if any, has just been crossed. */
export function crossedMilestone(
  before: number,
  after: number,
  alreadyCelebrated: number[],
): number | null {
  const hit = FREQUENCY_MILESTONES.find((m) => before < m && after >= m);
  if (!hit) return null;
  return alreadyCelebrated.includes(hit) ? null : hit;
}
