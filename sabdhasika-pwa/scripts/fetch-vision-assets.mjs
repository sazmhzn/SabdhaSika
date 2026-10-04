/**
 * Fetch the MediaPipe hand-landmarker assets into `public/vision/`.
 *
 * Runs automatically before `dev` and `build` (see package.json). The files are
 * ~18MB and git-ignored, so they are fetched rather than committed:
 *
 *   · the WASM runtime is already in `node_modules/@mediapipe/tasks-vision/wasm`
 *     — this copies it out so the app serves it from its own origin, which is
 *     what keeps recognition working offline and off Google's CDN;
 *   · the `hand_landmarker.task` model is downloaded from a pinned URL.
 *
 * Idempotent: existing, non-empty files are left alone, so running it on every
 * `dev` costs a couple of stat calls.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VISION_DIR = join(ROOT, "public", "vision");
const WASM_DEST = join(VISION_DIR, "wasm");
const WASM_SRC = join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const MODEL_DEST = join(VISION_DIR, "hand_landmarker.task");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
  "vision_wasm_module_internal.js",
  "vision_wasm_module_internal.wasm",
];

async function nonEmpty(path) {
  try {
    const s = await stat(path);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function copyWasm() {
  if (!existsSync(WASM_SRC)) {
    throw new Error(
      "MediaPipe is not installed. Run `npm install` first (the tasks-vision package ships the WASM).",
    );
  }
  await mkdir(WASM_DEST, { recursive: true });
  let copied = 0;
  for (const file of WASM_FILES) {
    const src = join(WASM_SRC, file);
    const dest = join(WASM_DEST, file);
    if (!existsSync(src)) continue;
    if (await nonEmpty(dest)) continue;
    await copyFile(src, dest);
    copied++;
  }
  return copied;
}

async function downloadModel() {
  if (await nonEmpty(MODEL_DEST)) return false;
  await mkdir(VISION_DIR, { recursive: true });
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error("model download returned an empty file");
  await writeFile(MODEL_DEST, buffer);
  return true;
}

async function main() {
  const copied = await copyWasm();
  const downloaded = await downloadModel();

  const summary = [];
  if (copied) summary.push(`copied ${copied} WASM file(s)`);
  if (downloaded) summary.push("downloaded hand_landmarker.task");
  console.log(
    summary.length
      ? `vision assets ready in public/vision (${summary.join(", ")})`
      : "vision assets already present",
  );
}

main().catch((err) => {
  console.error(`fetch-vision-assets: ${err.message}`);
  process.exit(1);
});
