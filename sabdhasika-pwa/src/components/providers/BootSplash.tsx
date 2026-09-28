"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { GlyphTile } from "@/components/ui/GlyphTile";

/**
 * Boot splash.
 *
 * Loading copy is written for this product, not for a generic spinner:
 * "Checking what's due" is literally what the scheduler is doing while
 * IndexedDB opens. Two lines, then it gets out of the way — a splash that
 * cycles through six jokes is a splash that has overstayed.
 */
const LINES = ["Opening today's words", "Checking what's due"];

export function BootSplash() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 1100);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-paper"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <GlyphTile glyph="श" reading="śa" badge="M" size={104} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          className="mt-7 text-[17px] font-extrabold tracking-[-0.02em] text-ink"
        >
          SabdhaSika
        </motion.p>

        <div className="mt-2 h-4 overflow-hidden">
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="block text-[12px] font-medium text-muted"
          >
            {LINES[i]}
          </motion.span>
        </div>

        <div className="mt-6 h-[3px] w-28 overflow-hidden rounded-full bg-surface-2">
          <motion.div
            className="h-full w-1/3 rounded-full bg-ink"
            animate={{ x: ["-120%", "360%"] }}
            transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  );
}
