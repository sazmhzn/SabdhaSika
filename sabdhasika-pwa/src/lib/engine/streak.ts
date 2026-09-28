import { dayKey, daysBetween } from "@/lib/date";
import type { StreakState } from "@/lib/types";

export const EMPTY_STREAK: StreakState = {
  current: 0,
  longest: 0,
  history: [],
};

/**
 * Called once, when a session is finished. A streak survives a single missed
 * day (the "grace day") because losing a 40-day run to one busy evening is
 * the single most demoralising thing a habit app can do.
 */
export function registerCompletion(streak: StreakState, now: Date = new Date()): StreakState {
  const today = dayKey(now);
  if (streak.lastCompletedDate === today) return streak;

  const gap = streak.lastCompletedDate ? daysBetween(streak.lastCompletedDate, today) : Infinity;

  let current: number;
  if (gap === 1) current = streak.current + 1;
  else if (gap === 2) current = streak.current + 1; // grace day
  else current = 1;

  const history = streak.history.includes(today) ? streak.history : [...streak.history, today];

  return {
    current,
    longest: Math.max(streak.longest, current),
    lastCompletedDate: today,
    history: history.slice(-400),
  };
}

/** Has today been completed? */
export function completedToday(streak: StreakState, now: Date = new Date()): boolean {
  return streak.lastCompletedDate === dayKey(now);
}

/** Would the streak break if the learner skipped today? */
export function atRisk(streak: StreakState, now: Date = new Date()): boolean {
  if (!streak.lastCompletedDate) return false;
  return daysBetween(streak.lastCompletedDate, now) === 2;
}

export function streakLabel(streak: StreakState): string {
  if (streak.current === 0) return "No streak yet";
  if (streak.current === 1) return "1 day";
  return `${streak.current} days`;
}
