"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Update toast.
 *
 * A new service worker has been installed. We do *not* reload underneath the
 * learner — that would throw away a half-finished card mid-reveal. We wait
 * for them to say when, and we only ever show it once per version.
 */
export function UpdateToast({
  ready,
}: {
  ready: ((reload: boolean) => void) | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setVisible(true), 2200);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <AnimatePresence>
      {visible && ready && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-panel border border-line bg-paper/95 p-4 shadow-lift backdrop-blur sm:bottom-6"
          role="status"
        >
          <span className="min-w-0 flex-1 text-[12.5px] font-medium text-ink-soft">
            A newer version is ready.
          </span>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              ready(true);
            }}
            className="press rounded-chip bg-ink px-3 py-2 text-[12px] font-semibold text-paper"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="press rounded-chip px-3 py-2 text-[12px] font-medium text-muted hover:text-ink"
          >
            Later
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
