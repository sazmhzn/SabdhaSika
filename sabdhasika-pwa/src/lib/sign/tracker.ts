/**
 * The hand detector: MediaPipe's `HandLandmarker`, wrapped so the rest of the
 * app never touches the tasks-vision API directly.
 *
 * Everything here runs on the device. The WASM runtime and the model are served
 * from `public/vision/` (populated by `scripts/fetch-vision-assets.mjs`), never
 * from a CDN, so recognition keeps working with no network — which is the whole
 * premise of this app.
 *
 * The wrapper has one job: turn a video frame into 21 landmarks, or `null`.
 * Anything that goes wrong (assets missing, GPU unavailable, a frame that
 * cannot be read) is reported as `null` or a typed error the UI can explain,
 * never as a thrown exception inside a render.
 */

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { Landmark } from "@/lib/sign/features";

/** Where the WASM bundle and the model live, relative to the site root. */
const WASM_PATH = "/vision/wasm";
const MODEL_PATH = "/vision/hand_landmarker.task";

export interface HandDetection {
  landmarks: Landmark[];
  /** "Left" or "Right", as reported by MediaPipe. Empty when unknown. */
  handedness: string;
}

export interface HandTracker {
  /** One frame. Returns `null` when no hand is visible or the frame is unusable. */
  detect(video: HTMLVideoElement, timestampMs: number): HandDetection | null;
  dispose(): void;
}

/**
 * Thrown when the model or WASM cannot be loaded — almost always because the
 * assets have not been fetched yet. The UI turns this into a "run the fetch
 * script" message rather than a blank camera.
 */
export class SignAssetsError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SignAssetsError";
  }
}

async function createLandmarker(delegate: "GPU" | "CPU"): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

/**
 * Build a tracker, preferring the GPU delegate and falling back to CPU.
 *
 * GPU is a large speed-up when it works and a hard failure when it does not
 * (older Safari, software rendering, a lost context), so the fallback is not a
 * nicety — it is what makes the feature work on the devices most likely to be
 * used for it.
 */
export async function createHandTracker(): Promise<HandTracker> {
  let landmarker: HandLandmarker;
  try {
    landmarker = await createLandmarker("GPU");
  } catch (gpuError) {
    try {
      landmarker = await createLandmarker("CPU");
    } catch {
      throw new SignAssetsError(
        "Could not load the hand model. Run `node scripts/fetch-vision-assets.mjs` and reload.",
        { cause: gpuError },
      );
    }
  }

  return {
    detect(video, timestampMs) {
      try {
        const result = landmarker.detectForVideo(video, timestampMs);
        const hand = result.landmarks?.[0];
        if (!hand || hand.length < 21) return null;
        return {
          landmarks: hand.map((p) => ({ x: p.x, y: p.y, z: p.z })),
          handedness: result.handedness?.[0]?.[0]?.categoryName ?? "",
        };
      } catch {
        return null;
      }
    },
    dispose() {
      try {
        landmarker.close();
      } catch {
        /* already closed */
      }
    },
  };
}
