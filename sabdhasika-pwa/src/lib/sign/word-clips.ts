/**
 * Word-sign reference clips for teach playback.
 *
 * Pilot vocab only (24 words). Clips are copied locally from repo-root SL/ by
 * `scripts/build-sl-index.mjs` into `public/sign-clips/` and are git-ignored:
 * the dataset licence is unverified, so nothing here may be bundled or shipped.
 * When the manifest is absent (fresh clone, no SL/), every helper degrades to
 * "no clip" rather than throwing — the page shows the cue text instead.
 */

export interface WordClip {
  gloss: string;
  slug: string;
  /** Public URL, e.g. `/sign-clips/thank-you.mp4`. */
  src: string;
}

function slugify(gloss: string): string {
  return gloss
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pilot vocab — must match PILOT_WORDS in scripts/build-sl-index.mjs. */
export const PILOT_WORDS: readonly string[] = [
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

export function clipFor(gloss: string): WordClip {
  const slug = slugify(gloss);
  return { gloss, slug, src: `/sign-clips/${slug}.mp4` };
}

export function allPilotClips(): WordClip[] {
  return PILOT_WORDS.map(clipFor);
}
