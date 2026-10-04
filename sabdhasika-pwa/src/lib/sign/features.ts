/**
 * Hand landmarks → the feature vector the classifier reads.
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS SHARED
 * ------------------------------------------
 * This is the single source of truth for "what is a hand". The recogniser at
 * runtime and the offline trainer both call `extractFeatures`, so a change to
 * the feature definition cannot silently drift between the two — the classic
 * train/serve skew that makes a model look fine in a notebook and useless in
 * the app.
 *
 * WHY THESE FEATURES AND NOT RAW COORDINATES
 * ------------------------------------------
 * A raw 21-point hand is mostly a description of where the hand is and how big
 * it is, which we do not care about. Every feature below is deliberately
 * invariant to translation and scale, and — except for the two orientation
 * values, which the letters G, H, P and Q genuinely depend on — invariant to
 * how the hand is turned. The result is a small, interpretable vector that maps
 * onto the same vocabulary the handshapes in `data/asl.ts` are already written
 * in: finger extension and thumb placement.
 *
 * Finger extension is measured as the ratio of the fingertip-to-knuckle chord
 * to the finger's own arc length. A straight finger has chord ≈ arc (ratio 1);
 * a folded finger has a short chord over a long arc (ratio → 0). That ratio is
 * threshold-free and identical whether the landmarks come from a real hand or
 * from the synthetic model the trainer draws, which is what makes the synthetic
 * training data usable at all.
 */

/** A MediaPipe normalised landmark: x and y in [0,1], z roughly in the same scale. */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface HandFeatures {
  values: number[];
}

/** Fixed length of `HandFeatures.values`. The model's input dimension. */
export const FEATURE_DIM = 20;

/** MediaPipe Hands emits 21 landmarks per hand. */
export const HAND_LANDMARK_COUNT = 21;

/**
 * Landmark indices, named.
 *
 * MediaPipe's ordering is fixed: the wrist, then four joints for each finger
 * from the thumb outward. Naming them here rather than sprinkling magic
 * indices through the maths is the difference between readable geometry and
 * a puzzle.
 */
const WRIST = 0;
const THUMB = [1, 2, 3, 4] as const;
const INDEX = [5, 6, 7, 8] as const;
const MIDDLE = [9, 10, 11, 12] as const;
const RING = [13, 14, 15, 16] as const;
const PINKY = [17, 18, 19, 20] as const;

const FINGERS = [THUMB, INDEX, MIDDLE, RING, PINKY] as const;

type Point = { x: number; y: number };

function finite(p: Landmark | undefined): p is Landmark {
  return Boolean(p) && Number.isFinite(p!.x) && Number.isFinite(p!.y);
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(u: Point, v: Point): number {
  const nu = Math.hypot(u.x, u.y);
  const nv = Math.hypot(v.x, v.y);
  if (nu === 0 || nv === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y) / (nu * nv)));
  return Math.acos(cos);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Extension of one finger, from the chord-to-arclength ratio.
 *
 * `chord / (|j0-j1| + |j1-j2| + |j2-j3|)`: 1 is dead straight, and the value
 * falls toward 0 as the finger folds. A fully closed finger still measures
 * around 0.35 rather than 0, because the three joints of a folded finger are
 * not quite collinear either, so the trainer and the runtime agree on the same
 * (non-zero) floor.
 */
function fingerExtension(joints: readonly number[], lm: Landmark[]): number {
  const j0 = lm[joints[0]];
  const j1 = lm[joints[1]];
  const j2 = lm[joints[2]];
  const j3 = lm[joints[3]];
  const arc = dist(j0, j1) + dist(j1, j2) + dist(j2, j3);
  if (arc === 0) return 0;
  return clamp(dist(j0, j3) / arc, 0, 1);
}

/**
 * Turn a hand into a feature vector, or `null` if there is no usable hand.
 *
 * Never throws: a malformed or missing hand returns `null`, and the caller
 * treats that as "nothing to recognise" rather than an error. That is what
 * lets a frame with no hand, or a half-tracked hand, pass through the frame
 * loop harmlessly.
 *
 * A left hand is mirrored to the canonical right-hand frame first, because
 * fingerspelling is a two-handed alphabet written the same way by either hand,
 * and a classifier trained on right hands should not see a left hand as a
 * different shape.
 */
export function extractFeatures(
  landmarks: Landmark[] | null | undefined,
  handedness?: string,
): HandFeatures | null {
  try {
    if (!Array.isArray(landmarks) || landmarks.length < HAND_LANDMARK_COUNT) return null;
    const hand = landmarks.slice(0, HAND_LANDMARK_COUNT);
    if (!hand.every(finite)) return null;

    const mirrored = handedness?.toLowerCase().startsWith("l");
    const lm: Landmark[] = mirrored
      ? hand.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }))
      : hand;

    const wrist = lm[WRIST];
    // Hand size, used to normalise every length so the features do not depend
    // on how far the hand is from the camera.
    const handSize = dist(wrist, lm[MIDDLE[0]]) || 1;

    const values: number[] = [];

    // 1. Five finger extensions (0 = folded, 1 = straight).
    for (const finger of FINGERS) values.push(fingerExtension(finger, lm));

    // 2. Four fingertip-to-wrist distances, normalised.
    for (const finger of [INDEX, MIDDLE, RING, PINKY]) {
      values.push(dist(wrist, lm[finger[3]]) / handSize);
    }

    // 3. Thumb placement: where the thumb tip sits relative to the knuckles.
    //    This is what separates A from S from T, and M from N, when the
    //    fingers themselves are almost identical.
    const thumbTip = lm[THUMB[3]];
    for (const anchor of [INDEX[0], MIDDLE[0], RING[0], PINKY[0], WRIST]) {
      values.push(dist(thumbTip, lm[anchor]) / handSize);
    }

    // 4. Spread between adjacent fingers — U against V, and W's fan.
    for (const [a, b] of [
      [INDEX, MIDDLE],
      [MIDDLE, RING],
      [RING, PINKY],
    ] as const) {
      const spread = angleBetween(sub(lm[a[3]], lm[a[0]]), sub(lm[b[3]], lm[b[0]]));
      values.push(clamp(spread / (Math.PI / 3), 0, 1.5));
    }

    // 5. Whether the index and middle have crossed — R against U and V.
    //    Measured as the lateral order of the two fingertips along the palm's
    //    forward axis, compared with the order of their knuckles.
    const axis = sub(lm[MIDDLE[0]], wrist);
    const axisLen = Math.hypot(axis.x, axis.y) || 1;
    const perp = { x: -axis.y / axisLen, y: axis.x / axisLen };
    const lateral = (p: Point) => ((p.x - wrist.x) * perp.x + (p.y - wrist.y) * perp.y) / handSize;
    const tipOrder = lateral(lm[INDEX[3]]) - lateral(lm[MIDDLE[3]]);
    const baseOrder = lateral(lm[INDEX[0]]) - lateral(lm[MIDDLE[0]]);
    values.push(clamp((tipOrder - baseOrder) * 2, -2, 2));

    // 6. Palm orientation, as a unit vector. G/H and P/Q differ from K and
    //    their upright forms only by how the hand is rotated, so rotation has
    //    to survive into the features for those letters to be separable.
    const angle = Math.atan2(axis.y, axis.x);
    values.push(Math.sin(angle), Math.cos(angle));

    if (values.length !== FEATURE_DIM) return null;
    return { values };
  } catch {
    return null;
  }
}
