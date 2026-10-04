import { dayKey } from "@/lib/date";
import { atRisk, completedToday } from "@/lib/engine/streak";
import type { AppState } from "@/lib/types";

/**
 * Reminders.
 *
 * The app has no backend, so it cannot wake a closed PWA. What it *can* do is
 * (a) show a quiet in-app nudge when the streak is about to break, and (b) fire
 * a Notification while the app is open. Both are honest about that limit — the
 * Settings copy says so rather than implying a push.
 */

const NOTIFIED_KEY = "sabdhasika:reminder-shown";
const EVENING_HOUR = 18;

/** True when skipping today would actually break the streak (two-day gap). */
export function streakAtRisk(state: AppState, now: Date = new Date()): boolean {
  if (state.streak.current <= 0) return false;
  if (completedToday(state.streak, now)) return false;
  return atRisk(state.streak, now);
}

/** Opt-in notification: an evening nudge while the app is open, at most once a day. */
export function reminderDue(state: AppState, now: Date = new Date()): boolean {
  if (!state.settings.reminderEnabled) return false;
  if (state.streak.current <= 0) return false;
  if (completedToday(state.streak, now)) return false;
  if (now.getHours() < EVENING_HOUR) return false;
  return !notifiedToday(now);
}

export function notifiedToday(now: Date = new Date()): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(NOTIFIED_KEY) === dayKey(now);
  } catch {
    return false;
  }
}

export function markNotified(now: Date = new Date()): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(NOTIFIED_KEY, dayKey(now));
  } catch {
    /* private mode — the in-app banner still works */
  }
}
