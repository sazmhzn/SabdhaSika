import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { scoreAttempt } from "@/lib/sign/word-dtw";
import { PILOT_WORDS } from "@/lib/sign/word-clips";
import { importWordTemplatesJson, loadWordTemplates } from "@/lib/sign/word-templates";

type Check = (name: string, condition: boolean, detail?: unknown) => void;

/**
 * SL-derived word templates (`scripts/data/sl-templates.json`).
 *
 * Written by `scripts/sign-words/extract.py` on a MediaPipe box. Checked in
 * the same spirit as the letter samples: shape first ( pilot coverage,
 * frame counts, 20-dim finite vectors), then a self-consistency proof — every
 * word's first sequence must DTW-match itself against the full pilot set.
 * That exercises the real scoring path (`scoreAttempt`) on real SL data
 * without a camera.
 *
 * Skipped when the file is absent (fresh clone, no SL/), so CI stays green.
 */
export function checkSlTemplates(check: Check): void {
  const templatesPath = join(process.cwd(), "scripts", "data", "sl-templates.json");
  if (!existsSync(templatesPath)) {
    check("SL template checks skipped until extract.py has run", true);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(templatesPath, "utf8"));
  } catch {
    check("sl-templates.json parses", false);
    return;
  }
  check("sl-templates.json parses", true);

  const words = (parsed as { words?: unknown }).words;
  check("templates carry a word list", Array.isArray(words), typeof words);
  if (!Array.isArray(words)) return;

  const bySlug = new Map<string, number[][][]>();
  for (const w of words as Array<{ slug?: unknown; sequences?: unknown }>) {
    if (typeof w?.slug === "string" && Array.isArray(w.sequences)) bySlug.set(w.slug, w.sequences as number[][][]);
  }
  const missing = PILOT_WORDS.map((g) => slugOf(g)).filter((s) => !bySlug.has(s));
  check("every pilot word has templates", missing.length === 0, missing.join(",") || `${bySlug.size} words`);

  let bad = 0;
  for (const [slug, seqs] of bySlug) {
    for (const seq of seqs) {
      if (
        !Array.isArray(seq) ||
        seq.length < 8 ||
        seq.length > 96 ||
        !seq.every((f) => Array.isArray(f) && f.length === 20 && f.every((v) => typeof v === "number" && Number.isFinite(v)))
      ) {
        bad++;
        break;
      }
    }
    if (bad > 0) break;
  }
  check("every sequence is 8–96 frames of 20 finite numbers", bad === 0);

  // The import seam the test page actually uses must accept this file whole.
  const { store, imported } = importWordTemplatesJson(loadWordTemplates(), JSON.stringify(parsed));
  check("the test page imports every word", imported === bySlug.size, `${imported}/${bySlug.size}`);

  // Self-consistency on the real scoring path.
  const firsts: Record<string, number[][][]> = {};
  for (const [slug, seqs] of Object.entries(store.templates)) firsts[slug] = [seqs[0]];
  let mismatched = 0;
  for (const [slug, seqs] of Object.entries(firsts)) {
    const scored = scoreAttempt(firsts, seqs[0]);
    if (scored?.best !== slug || scored.pass !== true) mismatched++;
  }
  check("every template self-matches on the scoring path", mismatched === 0, `${mismatched} mismatched`);
}

function slugOf(gloss: string): string {
  return gloss.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
