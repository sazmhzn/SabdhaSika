"""
Derive word-sign templates from repo-root SL/ videos.

Runs OFFLINE on a box with Python 3.11 + MediaPipe (this repo's dev box is on
Python 3.14, which has no MediaPipe wheels — see scripts/train-sign-model.mjs
for the same constraint). Needs::

    pip install "mediapipe==0.10.14" opencv-python

(1.0+ removed `mp.solutions`; the 0.10 pin keeps the Hands API this uses.)

What it does:
  1. walks SL/<gloss>/*.mp4 for the pilot words (or --words a,b,c),
  2. runs MediaPipe Hands per frame (mirroring left hands, like features.ts),
  3. extracts the SAME 20-dim vector `src/lib/sign/features.ts` defines
     (5 extensions, 4 tip-wrist, 5 thumb, 3 spreads, 1 cross, 2 orientation),
  4. writes templates JSON importable on the test page
     (Import JSON accepts {"words": [{"slug", "sequences"}]}).

Usage:
    python scripts/sign-words/extract.py --pilot
    python scripts/sign-words/extract.py --words hello,"thank you" --out /tmp/sl-templates.json
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys

PILOT = [
    "hello", "thank you", "please", "yes", "no", "good", "bad", "friend",
    "family", "love", "help", "eat", "drink", "water", "house", "school",
    "book", "time", "day", "night", "morning", "today", "what", "how",
]

WRIST = 0
THUMB = (1, 2, 3, 4)
INDEX = (5, 6, 7, 8)
MIDDLE = (9, 10, 11, 12)
RING = (13, 14, 15, 16)
PINKY = (17, 18, 19, 20)
FINGERS = (THUMB, INDEX, MIDDLE, RING, PINKY)

MAX_FRAMES = 96
MIN_FRAMES = 8


def slugify(gloss: str) -> str:
    out = "".join(c.lower() if c.isalnum() else "-" for c in gloss.strip())
    return "-".join(p for p in out.split("-") if p)


def _dist(a, b) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def _finger_extension(j, lm) -> float:
    j0, j1, j2, j3 = (lm[i] for i in j)
    arc = _dist(j0, j1) + _dist(j1, j2) + _dist(j2, j3)
    if arc == 0:
        return 0.0
    return _clamp(_dist(j0, j3) / arc, 0.0, 1.0)


def extract_features(lm, handedness: str = "") -> list[float] | None:
    """Mirror of extractFeatures() in src/lib/sign/features.ts."""
    try:
        if not lm or len(lm) < 21:
            return None
        pts = [(p[0], p[1]) for p in lm[:21]]
        if not all(math.isfinite(x) and math.isfinite(y) for x, y in pts):
            return None
        if handedness.lower().startswith("l"):
            pts = [(1.0 - x, y) for x, y in pts]
        wrist = pts[WRIST]
        hand_size = _dist(wrist, pts[MIDDLE[0]]) or 1.0
        values: list[float] = []
        for finger in FINGERS:
            values.append(_finger_extension(finger, pts))
        for finger in (INDEX, MIDDLE, RING, PINKY):
            values.append(_dist(wrist, pts[finger[3]]) / hand_size)
        thumb_tip = pts[THUMB[3]]
        for anchor in (INDEX[0], MIDDLE[0], RING[0], PINKY[0], WRIST):
            values.append(_dist(thumb_tip, pts[anchor]) / hand_size)

        def angle_between(u, v) -> float:
            nu, nv = math.hypot(*u), math.hypot(*v)
            if nu == 0 or nv == 0:
                return 0.0
            cos = _clamp((u[0] * v[0] + u[1] * v[1]) / (nu * nv), -1.0, 1.0)
            return math.acos(cos)

        def sub(a, b):
            return (a[0] - b[0], a[1] - b[1])

        for a, b in ((INDEX, MIDDLE), (MIDDLE, RING), (RING, PINKY)):
            spread = angle_between(sub(pts[a[3]], pts[a[0]]), sub(pts[b[3]], pts[b[0]]))
            values.append(_clamp(spread / (math.pi / 3), 0.0, 1.5))
        axis = sub(pts[MIDDLE[0]], wrist)
        axis_len = math.hypot(*axis) or 1.0
        perp = (-axis[1] / axis_len, axis[0] / axis_len)

        def lateral(p) -> float:
            return ((p[0] - wrist[0]) * perp[0] + (p[1] - wrist[1]) * perp[1]) / hand_size

        tip_order = lateral(pts[INDEX[3]]) - lateral(pts[MIDDLE[3]])
        base_order = lateral(pts[INDEX[0]]) - lateral(pts[MIDDLE[0]])
        values.append(_clamp((tip_order - base_order) * 2, -2.0, 2.0))
        angle = math.atan2(axis[1], axis[0])
        values.extend((math.sin(angle), math.cos(angle)))
        if len(values) != 20:
            return None
        return values
    except Exception:
        return None


def process_video(path: str) -> list[list[float]]:
    import cv2  # local import: only needed when actually extracting
    import mediapipe as mp

    cap = cv2.VideoCapture(path)
    frames: list[list[float]] = []
    hands = mp.solutions.hands.Hands(static_image_mode=False, max_num_hands=1)
    try:
        while True:
            ok, img = cap.read()
            if not ok:
                break
            res = hands.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            if not res.multi_hand_landmarks:
                continue
            hand = res.multi_hand_landmarks[0]
            lm = [(p.x, p.y) for p in hand.landmark]
            label = ""
            try:
                label = res.multi_handedness[0].classification[0].label or ""
            except Exception:
                label = ""
            feats = extract_features(lm, label)
            if feats:
                frames.append(feats)
    finally:
        hands.close()
        cap.release()
    if len(frames) > MAX_FRAMES:
        step = len(frames) / MAX_FRAMES
        frames = [frames[int(i * step)] for i in range(MAX_FRAMES)]
    return frames


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pilot", action="store_true")
    ap.add_argument("--words", default="")
    ap.add_argument("--sl", default="")
    ap.add_argument("--out", default="sl-templates.json")
    ap.add_argument("--per-word", type=int, default=3)
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    # scripts/sign-words -> sabdhasika-pwa -> repo root (where SL/ lives).
    repo_root = os.path.abspath(os.path.join(here, "..", "..", ".."))
    sl_root = os.path.abspath(args.sl) if args.sl else os.path.join(repo_root, "SL")
    if args.pilot:
        words = PILOT
    elif args.words:
        words = [w.strip() for w in args.words.split(",") if w.strip()]
    else:
        words = PILOT
    if not os.path.isdir(sl_root):
        print(f"SL/ not found at {sl_root}", file=sys.stderr)
        return 1

    out_words = []
    for gloss in words:
        d = os.path.join(sl_root, gloss)
        if not os.path.isdir(d):
            print(f"skip {gloss}: no folder")
            continue
        clips = sorted(f for f in os.listdir(d) if f.lower().endswith(".mp4"))[: args.per_word]
        seqs = []
        for clip in clips:
            try:
                seq = process_video(os.path.join(d, clip))
            except Exception as e:  # noqa: BLE001 — one bad clip must not kill the run
                print(f"skip {gloss}/{clip}: {e}")
                continue
            if len(seq) >= MIN_FRAMES:
                seqs.append(seq)
            else:
                print(f"skip {gloss}/{clip}: only {len(seq)} hand frames")
        if seqs:
            out_words.append({"gloss": gloss, "slug": slugify(gloss), "sequences": seqs})
            print(f"{gloss}: {len(seqs)} sequences")
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "words": out_words}, f)
    print(f"wrote {args.out} ({len(out_words)} words)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
