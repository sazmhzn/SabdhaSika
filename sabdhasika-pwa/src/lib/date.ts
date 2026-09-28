/** Date helpers. Everything is keyed on the user's *local* calendar day. */

export const DAY_MS = 86_400_000;

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(d: Date = new Date()): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Whole calendar days from `a` to `b` (b - a). Negative if b is earlier. */
export function daysBetween(a: Date | string, b: Date | string): number {
  const da = startOfDay(typeof a === "string" ? new Date(`${a}T00:00:00`) : a);
  const db = startOfDay(typeof b === "string" ? new Date(`${b}T00:00:00`) : b);
  return Math.round((db.getTime() - da.getTime()) / DAY_MS);
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return daysBetween(a, b) === 0;
}

/** "today" / "yesterday" / "3 days ago" — used in copy, not in layout. */
export function relativeDayLabel(date: string, now: Date = new Date()): string {
  const diff = daysBetween(date, now);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff === -1) return "tomorrow";
  if (diff > 1) return `${diff} days ago`;
  return `in ${Math.abs(diff)} days`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Deterministic 32-bit hash — used to seed the per-day RNG. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
