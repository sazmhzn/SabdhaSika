/**
 * Haptics. A 8ms tick on a card rating is the difference between "an app
 * responded" and "the app felt me". No-op everywhere it is unsupported.
 */

type Pattern = number | number[];

function supported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function buzz(pattern: Pattern, enabled = true): void {
  if (!enabled || !supported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export const haptics = {
  /** Light tick — rating a card, toggling a setting. */
  tick: (on = true) => buzz(8, on),
  /** Reveal — slightly more presence. */
  reveal: (on = true) => buzz(12, on),
  /** Correct answer — a double pulse reads as "yes". */
  correct: (on = true) => buzz([10, 40, 14], on),
  /** Incorrect — one soft thud. */
  incorrect: (on = true) => buzz(22, on),
  /** Session complete — a small roll. */
  celebrate: (on = true) => buzz([14, 50, 14, 50, 26], on),
  /** Milestone — the biggest one we allow. */
  milestone: (on = true) => buzz([18, 60, 18, 60, 18, 60, 34], on),
};

/** iOS Safari has no Vibration API — tell the UI so it can adjust copy. */
export function hapticsSupported(): boolean {
  return supported();
}
