import type { MetricEvent, MetricEventName, MetricSummary } from "@/lib/types";

/**
 * Delight instrumentation.
 *
 * Every hypothesis in the UX strategy document names a metric. This module is
 * what makes those names real. It is:
 *   - local only (localStorage, never sent anywhere),
 *   - bounded (500-event ring buffer),
 *   - inspectable (the Settings screen shows the live numbers).
 *
 * If a "delightful" change does not move one of these, it is decoration.
 */

const KEY = "sabdhasika:metrics";
const MAX_EVENTS = 500;

let buffer: MetricEvent[] | null = null;

function read(): MetricEvent[] {
  if (buffer) return buffer;
  if (typeof localStorage === "undefined") {
    buffer = [];
    return buffer;
  }
  try {
    const raw = localStorage.getItem(KEY);
    buffer = raw ? (JSON.parse(raw) as MetricEvent[]) : [];
  } catch {
    buffer = [];
  }
  return buffer;
}

function write(events: MetricEvent[]) {
  buffer = events;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    /* ignore */
  }
}

export function track(name: MetricEventName, data?: Record<string, number | string | boolean>): void {
  if (typeof window === "undefined") return;
  const events = read();
  events.push({ name, at: Date.now(), data });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  write(events);
}

export function allEvents(): MetricEvent[] {
  return read();
}

export function clearMetrics(): void {
  write([]);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Time from app open to the first card being interactive, per app-open.
 * Pairing is sequential: an `app_open` starts a window, the next
 * `first_card_ready` closes it.
 */
function timeToFirstCard(events: MetricEvent[]): number[] {
  const out: number[] = [];
  let openedAt: number | null = null;
  for (const e of events) {
    if (e.name === "app_open") openedAt = e.at;
    else if (e.name === "first_card_ready" && openedAt !== null) {
      out.push(e.at - openedAt);
      openedAt = null;
    }
  }
  return out;
}

/** Gaps between consecutive ratings, excluding the retry-pass jump. */
function ratingGaps(events: MetricEvent[]): number[] {
  const out: number[] = [];
  let last: number | null = null;
  for (const e of events) {
    if (e.name !== "rating_given") continue;
    if (last !== null) {
      const gap = e.at - last;
      // Ignore gaps > 2 min: the learner walked away, that's not "pace".
      if (gap < 120_000) out.push(gap);
    }
    last = e.at;
  }
  return out;
}

export function summarize(events: MetricEvent[] = read()): MetricSummary {
  const ttf = timeToFirstCard(events);
  const gaps = ratingGaps(events);

  const ratings = events.filter((e) => e.name === "rating_given");
  const hard = ratings.filter((e) => e.data?.rating === "hard").length;

  const starts = events.filter((e) => e.name === "session_start").length;
  const completes = events.filter((e) => e.name === "session_complete").length;

  const recall = events.filter((e) => e.name === "recall_answered");
  const recalled = recall.filter((e) => e.data?.remembered === true).length;

  return {
    timeToFirstCardMs: median(ttf),
    medianRatingGapMs: median(gaps),
    hardRate: ratings.length ? hard / ratings.length : null,
    sessionCompletionRate: starts ? Math.min(1, completes / starts) : null,
    offlineSessions: events.filter((e) => e.name === "offline_session").length,
    recallAccuracy: recall.length ? recalled / recall.length : null,
    totalEvents: events.length,
  };
}

/* ------------------------------------------------------------------ *
 * Presentation helpers for the debug panel
 * ------------------------------------------------------------------ */

export function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

/**
 * A target band per metric, straight from the strategy document. The panel
 * colours the live number against these so the team can see at a glance
 * whether the delight work is landing.
 */
export const METRIC_TARGETS = {
  timeToFirstCardMs: { good: 1500, warn: 3000, lowerIsBetter: true, label: "Time to first card" },
  medianRatingGapMs: { good: 12000, warn: 25000, lowerIsBetter: true, label: "Pace per card" },
  hardRate: { good: 0.25, warn: 0.4, lowerIsBetter: true, label: "Hard rating share" },
  sessionCompletionRate: {
    good: 0.7,
    warn: 0.45,
    lowerIsBetter: false,
    label: "Session completion",
  },
  recallAccuracy: {
    good: 0.6,
    warn: 0.4,
    lowerIsBetter: false,
    label: "Recall accuracy",
  },
} as const;

export function metricTone(
  key: keyof typeof METRIC_TARGETS,
  value: number | null,
): "good" | "warn" | "bad" | "none" {
  if (value === null) return "none";
  const t = METRIC_TARGETS[key];
  if (t.lowerIsBetter) {
    if (value <= t.good) return "good";
    if (value <= t.warn) return "warn";
    return "bad";
  }
  if (value >= t.good) return "good";
  if (value >= t.warn) return "warn";
  return "bad";
}
