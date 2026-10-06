import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { PILOT_WORDS } from "@/lib/sign/word-clips";

type Check = (name: string, condition: boolean, detail?: unknown) => void;

/**
 * Word-sign reference clips (teach playback).
 *
 * Defends the pilot contract: every pilot word slugs to a non-empty local
 * clip. Skipped (not failed) when SL/ was never indexed — a fresh clone
 * without videos must stay green.
 */
export function checkWordClips(check: Check): void {
  const manifestPath = join(process.cwd(), "public", "word-clips.json");
  if (!existsSync(manifestPath)) {
    check("word-clip checks skipped until `node scripts/build-sl-index.mjs`", true);
    return;
  }
  for (const gloss of PILOT_WORDS) {
    const slug = gloss.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const clipPath = join(process.cwd(), "public", "sign-clips", `${slug}.mp4`);
    const present = existsSync(clipPath);
    check(`clip present for "${gloss}"`, present, clipPath);
    if (present) {
      let size = 0;
      try {
        size = statSync(clipPath).size;
      } catch {
        size = 0;
      }
      check(`clip non-empty for "${gloss}"`, size > 0, `${size} bytes`);
    }
  }
}
