"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a number up to its target with an ease-out curve.
 *
 * Used for the session summary ("347 → 359"). A number that simply appears is
 * information; a number that *arrives* is a small reward. Capped at 900ms so
 * it never delays the button underneath it.
 */
export function useCountUp(target: number, duration = 820, enabled = true): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [duration, enabled, target]);

  return value;
}

/** Fires `onFire` when `key` changes, and returns whether to show the burst. */
export function useBurst(key: number | string, ms = 1800): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(true);
    const t = setTimeout(() => setActive(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return active;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** True when the device is likely to show a real keyboard. */
export function useHasKeyboard(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}
