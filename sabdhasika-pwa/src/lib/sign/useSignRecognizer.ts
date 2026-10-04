"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { extractFeatures, type HandFeatures, type Landmark } from "@/lib/sign/features";
import { classify, CONFIDENCE_THRESHOLD, type SignModel } from "@/lib/sign/model";
import { createHandTracker, SignAssetsError, type HandTracker } from "@/lib/sign/tracker";

export type SignStatus = "idle" | "loading" | "running" | "denied" | "unsupported" | "error";

/** The most recent frame, updated imperatively so 30fps does not thrash React. */
export interface SignFrame {
  landmarks: Landmark[] | null;
  features: HandFeatures | null;
  handedness: string;
}

/**
 * The MediaPipe 21-point hand skeleton, as index pairs.
 *
 * Hard-coded rather than read off the library, because it is a fixed part of
 * the model's output format and does not change between versions — and a
 * literal list is one less thing that can fail at runtime.
 */
const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

/** Frames considered when deciding whether a letter is being held. */
const STABILITY_WINDOW = 8;
/** How many of those frames must agree before the letter is reported. */
const STABILITY_MIN = 5;
/** Detection is throttled to roughly 30fps — past that, nothing improves. */
const MIN_FRAME_MS = 30;

export interface UseSignRecognizerResult {
  status: SignStatus;
  error: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Latest frame, for a recorder that samples features without re-rendering. */
  latest: RefObject<SignFrame>;
  /** The stable letter, or null. Changes only when it actually changes. */
  letter: string | null;
  confidence: number;
  hasHand: boolean;
  start: () => void;
  stop: () => void;
  retry: () => void;
}

/**
 * Owns the camera and the recognition loop.
 *
 * Deliberately imperative: the loop runs at ~30fps and pushes everything that
 * changes that fast into refs and a canvas, not into state. Only the handful of
 * values a human actually reacts to — the status, the stable letter, whether a
 * hand is present — are React state, and each is set only when it changes.
 *
 * The start is a user gesture (a button), which is both what iOS requires
 * before it will hand over a camera and a reasonable thing to ask before
 * turning one on.
 */
export function useSignRecognizer(options: { model?: SignModel | null } = {}): UseSignRecognizerResult {
  const { model = null } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latest = useRef<SignFrame>({ landmarks: null, features: null, handedness: "" });
  const trackerRef = useRef<HandTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const lastTsRef = useRef(0);
  const lastDetectRef = useRef(0);
  const bufferRef = useRef<Array<{ label: string; confidence: number }>>([]);
  const modelRef = useRef<SignModel | null>(model);
  const hasHandRef = useRef(false);
  const letterRef = useRef<string | null>(null);
  const confidenceRef = useRef(0);

  const [status, setStatus] = useState<SignStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [hasHand, setHasHand] = useState(false);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  /** Draw the skeleton over the frame, mirrored to match the selfie view. */
  const drawOverlay = useCallback((landmarks: Landmark[] | null) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const videoWidth = video?.videoWidth ?? 0;
    const videoHeight = video?.videoHeight ?? 0;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || videoWidth;
    const cssH = rect.height || videoHeight;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const width = Math.max(1, Math.round(cssW * dpr));
    const height = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!landmarks) return;

    // The video is shown mirrored, so the overlay is mirrored to match it.
    const px = (i: number) => (1 - landmarks[i].x) * width;
    const py = (i: number) => landmarks[i].y * height;

    ctx.lineWidth = Math.max(2, 3 * dpr);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
    }
    ctx.stroke();

    const r = Math.max(2.5, 4 * dpr);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    for (let i = 0; i < landmarks.length; i++) {
      ctx.beginPath();
      ctx.arc(px(i), py(i), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    rafRef.current = requestAnimationFrame(loop);

    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (!video || !tracker || video.readyState < 2 || video.videoWidth === 0) return;

    const now = performance.now();
    if (now - lastDetectRef.current < MIN_FRAME_MS) return;
    lastDetectRef.current = now;
    if (now <= lastTsRef.current) lastTsRef.current += 1;
    else lastTsRef.current = now;

    const detection = tracker.detect(video, lastTsRef.current);

    if (!detection) {
      latest.current = { landmarks: null, features: null, handedness: "" };
      bufferRef.current = [];
      drawOverlay(null);
      if (hasHandRef.current) {
        hasHandRef.current = false;
        setHasHand(false);
      }
      if (letterRef.current !== null) {
        letterRef.current = null;
        setLetter(null);
      }
      if (confidenceRef.current !== 0) {
        confidenceRef.current = 0;
        setConfidence(0);
      }
      return;
    }

    const features = extractFeatures(detection.landmarks, detection.handedness);
    latest.current = { landmarks: detection.landmarks, features, handedness: detection.handedness };
    drawOverlay(detection.landmarks);
    if (!hasHandRef.current) {
      hasHandRef.current = true;
      setHasHand(true);
    }

    const currentModel = modelRef.current;
    if (!currentModel || !features) return;

    const prediction = classify(currentModel, features);
    bufferRef.current.push({ label: prediction.letter ?? "?", confidence: prediction.confidence });
    if (bufferRef.current.length > STABILITY_WINDOW) bufferRef.current.shift();

    // Majority vote over the window, so a single stray frame cannot flip the
    // letter. Confidence is the mean over the frames that voted for it.
    const counts = new Map<string, { n: number; conf: number }>();
    for (const entry of bufferRef.current) {
      const b = counts.get(entry.label) ?? { n: 0, conf: 0 };
      b.n += 1;
      b.conf += entry.confidence;
      counts.set(entry.label, b);
    }
    let best = "?";
    let bestN = 0;
    let bestConf = 0;
    for (const [label, { n, conf }] of counts) {
      if (n > bestN) {
        best = label;
        bestN = n;
        bestConf = conf / n;
      }
    }
    const stable = best !== "?" && bestN >= STABILITY_MIN && bestConf >= CONFIDENCE_THRESHOLD ? best : null;
    const stableConf = stable ? bestConf : 0;

    if (stable !== letterRef.current) {
      letterRef.current = stable;
      setLetter(stable);
    }
    if (Math.abs(stableConf - confidenceRef.current) > 0.01) {
      confidenceRef.current = stableConf;
      setConfidence(stableConf);
    }
  }, [drawOverlay]);

  /** Stop everything without touching React state (safe during unmount). */
  const teardown = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    trackerRef.current?.dispose();
    trackerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    bufferRef.current = [];
    latest.current = { landmarks: null, features: null, handedness: "" };
    hasHandRef.current = false;
    letterRef.current = null;
    confidenceRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    teardown();
    setStatus("idle");
    setError(null);
    setLetter(null);
    setConfidence(0);
    setHasHand(false);
  }, [teardown]);

  const start = useCallback(async () => {
    if (runningRef.current || startingRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError("This device or browser does not expose a camera to web pages.");
      return;
    }

    startingRef.current = true;
    setStatus("loading");
    setError(null);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setError("Camera access was blocked. Allow it in your browser settings, then try again.");
        } else {
          setStatus("error");
          setError("Could not start the camera.");
        }
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStatus("error");
        setError("The camera view is not ready yet.");
        return;
      }

      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* autoplay refusal is fine; the stream still renders */
      }

      // The screen may have unmounted while the camera was starting; the
      // unmount teardown already released everything, so there is nothing left
      // to attach a tracker to.
      if (!videoRef.current) return;

      try {
        trackerRef.current = await createHandTracker();
      } catch (err) {
        teardown();
        setStatus("error");
        setError(err instanceof SignAssetsError ? err.message : "Could not load the hand model.");
        return;
      }

      runningRef.current = true;
      lastDetectRef.current = 0;
      setStatus("running");
      rafRef.current = requestAnimationFrame(loop);
    } finally {
      startingRef.current = false;
    }
  }, [loop, teardown]);

  const retry = useCallback(() => {
    stop();
    void start();
  }, [start, stop]);

  useEffect(() => teardown, [teardown]);

  return {
    status,
    error,
    videoRef,
    canvasRef,
    latest,
    letter,
    confidence,
    hasHand,
    start,
    stop,
    retry,
  };
}
