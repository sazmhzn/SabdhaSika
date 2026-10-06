/**
 * Index word-sign reference clips from repo-root SL/ for teach playback.
 *
 * SL/ layout: <gloss>/<id>.mp4 (WLASL-style, ~2000 glosses, licence
 * unverified — never committed, see root .gitignore).
 *
 * What this does:
 *   1. scans SL/ for all glosses (count + clips, skips empties),
 *   2. copies the first clip of each PILOT word to public/sign-clips/<slug>.mp4,
 *   3. writes public/word-clips.json (slug, gloss, clip count, src).
 *
 * Idempotent: skips copies whose dest exists and is non-empty.
 * Run: node scripts/build-sl-index.mjs
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PWA_ROOT = resolve(HERE, "..");
const SL_ROOT = resolve(PWA_ROOT, "..", "SL");
const CLIPS_DEST = join(PWA_ROOT, "public", "sign-clips");
const MANIFEST_DEST = join(PWA_ROOT, "public", "word-clips.json");

/** Pilot vocab: common words, all confirmed present in SL/. */
export const PILOT_WORDS = [
  "hello",
  "thank you",
  "please",
  "yes",
  "no",
  "good",
  "bad",
  "friend",
  "family",
  "love",
  "help",
  "eat",
  "drink",
  "water",
  "house",
  "school",
  "book",
  "time",
  "day",
  "night",
  "morning",
  "today",
  "what",
  "how",
];

export function slugify(gloss) {
  return gloss.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function nonEmpty(path) {
  try {
    const s = await stat(path);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(SL_ROOT)) {
    throw new Error(`SL/ not found at ${SL_ROOT}. Clone/copy the dataset to repo root first.`);
  }
  const entries = await readdir(SL_ROOT, { withFileTypes: true });
  const glosses = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const counts = {};
  for (const gloss of glosses) {
    const files = (await readdir(join(SL_ROOT, gloss))).filter((f) =>
      f.toLowerCase().endsWith(".mp4"),
    );
    counts[gloss] = files;
  }

  await mkdir(CLIPS_DEST, { recursive: true });
  const manifest = [];
  const missing = [];
  for (const gloss of PILOT_WORDS) {
    const files = counts[gloss];
    if (!files || files.length === 0) {
      missing.push(gloss);
      continue;
    }
    const src = join(SL_ROOT, gloss, [...files].sort()[0]);
    const dest = join(CLIPS_DEST, `${slugify(gloss)}.mp4`);
    if (!(await nonEmpty(dest))) await copyFile(src, dest);
    manifest.push({ gloss, slug: slugify(gloss), clips: files.length, src: `/sign-clips/${slugify(gloss)}.mp4` });
  }

  await writeFile(MANIFEST_DEST, `${JSON.stringify({ words: manifest }, null, 2)}\n`);
  console.log(`indexed ${glosses.length} glosses, pilot ${manifest.length}/${PILOT_WORDS.length} clips -> public/sign-clips/`);
  if (missing.length) console.log(`missing pilot glosses: ${missing.join(", ")}`);
}

main().catch((err) => {
  console.error(`build-sl-index: ${err.message}`);
  process.exit(1);
});
