import {
  RESAMPLE_LEN,
  dtwDistance,
  frameDistance,
  resampleFrames,
  scoreAttempt,
} from "@/lib/sign/word-dtw";

type Check = (name: string, condition: boolean, detail?: unknown) => void;

/**
 * Word-sign DTW scorer, checked without a camera.
 *
 * Seams under test: `frameDistance`, `dtwDistance`, `resampleFrames`,
 * `scoreAttempt` in `src/lib/sign/word-dtw.ts`. Expected values are
 * hand-worked literals, never recomputed the way the code does.
 */
export function checkWordDtw(check: Check): void {
  // ── frame distance is euclidean ───────────────────────────────────
  check("identical frames are 0 apart", frameDistance([0, 0], [0, 0]) === 0);
  check("a 3-4-5 triangle is 5", frameDistance([0, 0], [3, 4]) === 5);
  check("mismatched lengths are not a number", Number.isNaN(frameDistance([1], [1, 2])));
  check("empty frames are not a number", Number.isNaN(frameDistance([], [])));

  // ── DTW on hand-worked toy sequences ──────────────────────────────
  const flat = [
    [0],
    [0],
    [0],
  ];
  check("an identical sequence costs 0", dtwDistance(flat, flat.map((f) => [...f])) === 0);
  // |0-1| + |0-1| + |0-1| along the diagonal: 3.
  check("a constant offset accumulates", dtwDistance(flat, [[1], [1], [1]]) === 3, dtwDistance(flat, [[1], [1], [1]]));
  // Extra frames align for free against a matching value: still 0.
  check("a stretched repetition costs 0", dtwDistance([[0]], [[0], [0], [0]]) === 0);
  // Symmetry on the full window.
  const a = [[0], [1], [2]];
  const b = [[0], [0], [2]];
  check("distance is symmetric", dtwDistance(a, b) === dtwDistance(b, a));
  // Degenerate inputs never throw and never look like a match.
  check("empty vs empty is not finite", !Number.isFinite(dtwDistance([], [])));
  check("empty vs frames is not finite", !Number.isFinite(dtwDistance([], [[0]])));
  let threw = false;
  try {
    dtwDistance([], []);
    dtwDistance([[0]], []);
    dtwDistance([[]], [[0]]);
  } catch {
    threw = true;
  }
  check("never throws on degenerate input", !threw);

  // ── resampling ────────────────────────────────────────────────────
  const long = Array.from({ length: 100 }, (_, i) => [i]);
  const short = resampleFrames(long, 48);
  check("resampling fixes the length", short.length === 48, short.length);
  check("resampling keeps the endpoints", short[0][0] === 0 && short[47][0] === 99);
  check("default length is the model constant", resampleFrames(long).length === RESAMPLE_LEN);
  check("resampling nothing yields nothing", resampleFrames([]).length === 0);

  // ── scoring picks the nearest template ────────────────────────────
  const templates = {
    hello: [
      [
        [0],
        [0],
        [0],
      ],
    ],
    thanks: [
      [
        [10],
        [10],
        [10],
      ],
    ],
  };
  const near = [
    [0.1],
    [0],
    [0.1],
  ];
  const scored = scoreAttempt(templates, near);
  check("the nearest word wins", scored?.best === "hello", scored?.best);
  check("a matching attempt passes", scored?.pass === true);
  check("confidence is a probability", (scored?.confidence ?? -1) >= 0 && (scored?.confidence ?? 2) <= 1);
  const far = [[50], [50], [50]];
  const farScored = scoreAttempt(templates, far);
  check("a wild attempt does not pass", farScored?.pass === false);
  check("no templates yields no score", scoreAttempt({}, near) === null);
  check("an empty attempt yields no score", scoreAttempt(templates, []) === null);
}
