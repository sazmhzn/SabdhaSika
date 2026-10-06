/**
 * Word-sign scorer: dynamic time warping over hand-feature sequences.
 *
 * WHY DTW AND NOT THE STATIC CLASSIFIER
 * -------------------------------------
 * `model.ts` reads one held handshape. A word sign is motion — a trajectory
 * through feature space — so the unit compared here is a *sequence* of the
 * same 20-dim vectors `extractFeatures` already emits. Same features at
 * enroll time and at test time means no train/serve skew by construction.
 *
 * Distances are raw totals along the warp path. They are only comparable
 * between equal-length sequences, which is why everything is resampled to
 * `RESAMPLE_LEN` before scoring (templates at enroll/import time, attempts
 * at score time).
 *
 * Never throws: degenerate input yields non-finite distances and a `null`
 * score, so a dropped camera frame degrades to "try again", not a crash.
 */

/** Frames per sequence after resampling. Small enough for O(n·m) DTW at 60fps. */
export const RESAMPLE_LEN = 48;

/**
 * Maximum mean warp cost that still counts as a match.
 *
 * Provisional: picked so an identical recording passes with margin and a
 * random flail fails by an order of magnitude. Re-calibrate from real
 * enroll/test pairs (or SL-derived templates) once they exist.
 */
export const PASS_THRESHOLD = 2.5;

export type Frame = number[];
export type Sequence = Frame[];

/** Euclidean distance. NaN when the frames are not comparable. */
export function frameDistance(a: Frame, b: Frame): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return NaN;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    if (!Number.isFinite(d)) return NaN;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function validSequence(s: Sequence): boolean {
  if (!Array.isArray(s) || s.length === 0) return false;
  const dim = s[0]?.length ?? 0;
  if (dim === 0) return false;
  return s.every((f) => Array.isArray(f) && f.length === dim && f.every(Number.isFinite));
}

/**
 * Full-window DTW total cost. Symmetric: dtw(a, b) === dtw(b, a).
 * Non-finite when either side is degenerate.
 */
export function dtwDistance(a: Sequence, b: Sequence): number {
  if (!validSequence(a) || !validSequence(b)) return Infinity;
  const n = a.length;
  const m = b.length;
  const prev = new Array<number>(m + 1).fill(Infinity);
  const curr = new Array<number>(m + 1).fill(Infinity);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    curr[0] = Infinity;
    for (let j = 1; j <= m; j++) {
      const cost = frameDistance(a[i - 1], b[j - 1]);
      curr[j] = cost + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    for (let j = 0; j <= m; j++) prev[j] = curr[j];
  }
  return prev[m];
}

/** Uniform resample (linear interp) to `n` frames, endpoints preserved. */
export function resampleFrames(frames: Sequence, n: number = RESAMPLE_LEN): Sequence {
  if (!Array.isArray(frames) || frames.length === 0) return [];
  if (frames.length === 1) return Array.from({ length: n }, () => [...frames[0]]);
  const out: Sequence = [];
  const last = frames.length - 1;
  for (let i = 0; i < n; i++) {
    const pos = (i * last) / (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(last, lo + 1);
    const t = pos - lo;
    out.push(frames[lo].map((v, d) => v + (frames[hi][d] - v) * t));
  }
  return out;
}

export interface ScoredGloss {
  gloss: string;
  distance: number;
}

export interface AttemptScore {
  best: string;
  distance: number;
  /** 0–1: margin of the winner over the runner-up. */
  confidence: number;
  /** True when the winner is close enough to count as a match. */
  pass: boolean;
  results: ScoredGloss[];
}

/**
 * Rank every templated gloss against one attempt.
 *
 * Returns `null` with no templates or no attempt — "nothing to score", not an
 * error. The caller decides whether `best` equals the prompted word; `pass`
 * only says the match is close enough to believe.
 */
export function scoreAttempt(
  templates: Record<string, Sequence[]>,
  attempt: Sequence,
): AttemptScore | null {
  const glosses = Object.keys(templates).filter((g) => templates[g].length > 0);
  if (glosses.length === 0 || !validSequence(attempt)) return null;
  const probe = resampleFrames(attempt);
  const results: ScoredGloss[] = glosses.map((gloss) => {
    let best = Infinity;
    for (const seq of templates[gloss]) {
      const d = dtwDistance(resampleFrames(seq), probe);
      if (d < best) best = d;
    }
    return { gloss, distance: best };
  });
  results.sort((x, y) => x.distance - y.distance);
  const [first, second] = [results[0], results[1]];
  const confidence = second
    ? 1 - first.distance / (first.distance + second.distance || 1)
    : 1 / (1 + first.distance);
  return {
    best: first.gloss,
    distance: first.distance,
    confidence: Math.min(1, Math.max(0, confidence)),
    pass: first.distance <= PASS_THRESHOLD,
    results,
  };
}
