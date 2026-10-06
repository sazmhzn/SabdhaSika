/**
 * Enrolled word-sign templates.
 *
 * Each template is one recorded attempt: a sequence of the same 20-dim
 * feature vectors the live recogniser emits, resampled to `RESAMPLE_LEN` on
 * the way in. They live in `localStorage` for the same reason letter samples
 * do — small (48 frames × 20 numbers each) and must survive a reload
 * mid-enrollment.
 *
 * Two origins feed this store through one shape:
 *   · self-enrollment on the test page (this device, this signer);
 *   · `scripts/sign-words/extract.py` output imported as JSON (SL-derived,
 *     once a Python 3.11 + MediaPipe box has run it).
 *
 * Nothing here is sent anywhere. Scoring in `word-dtw.ts` runs on-device
 * against these templates.
 */

import { RESAMPLE_LEN, resampleFrames, type Sequence } from "@/lib/sign/word-dtw";

const STORAGE_KEY = "sabdhasika:word-templates";
const VERSION = 1;
/** Templates kept per word — newest wins past this. */
const MAX_PER_WORD = 5;
/** Raw recorded frames accepted per attempt (before resampling). */
const MAX_RAW_FRAMES = 240;

export interface WordTemplateStore {
  version: number;
  templates: Record<string, Sequence[]>;
}

const EMPTY: WordTemplateStore = { version: VERSION, templates: {} };

function validFrame(values: unknown, dim: number): values is number[] {
  return (
    Array.isArray(values) &&
    (dim === 0 || values.length === dim) &&
    values.length > 0 &&
    values.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

function validSequence(seq: unknown): seq is Sequence {
  if (!Array.isArray(seq) || seq.length === 0 || seq.length > MAX_RAW_FRAMES) return false;
  const dim = Array.isArray(seq[0]) ? seq[0].length : 0;
  return seq.every((f) => validFrame(f, dim));
}

export function loadWordTemplates(): WordTemplateStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as WordTemplateStore;
    if (!parsed || typeof parsed.templates !== "object") return EMPTY;
    const templates: Record<string, Sequence[]> = {};
    for (const [slug, seqs] of Object.entries(parsed.templates)) {
      if (!Array.isArray(seqs)) continue;
      const kept = seqs.filter(validSequence).map((s) => resampleFrames(s));
      if (kept.length > 0) templates[slug] = kept.slice(-MAX_PER_WORD);
    }
    return { version: VERSION, templates };
  } catch {
    return EMPTY;
  }
}

function save(store: WordTemplateStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota or private mode — the in-memory copy is still usable */
  }
}

/** Record one enrollment. Resamples to fixed length; keeps the newest five. */
export function addWordTemplate(store: WordTemplateStore, slug: string, frames: Sequence): WordTemplateStore {
  if (!validSequence(frames)) return store;
  const seq = resampleFrames(frames);
  const next: WordTemplateStore = {
    version: VERSION,
    templates: { ...store.templates, [slug]: [...(store.templates[slug] ?? []), seq].slice(-MAX_PER_WORD) },
  };
  save(next);
  return next;
}

export function clearWordTemplate(store: WordTemplateStore, slug: string): WordTemplateStore {
  const next: WordTemplateStore = { version: VERSION, templates: { ...store.templates } };
  delete next.templates[slug];
  save(next);
  return next;
}

export function clearAllWordTemplates(): WordTemplateStore {
  save(EMPTY);
  return EMPTY;
}

export function countByWord(store: WordTemplateStore): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [slug, seqs] of Object.entries(store.templates)) counts[slug] = seqs.length;
  return counts;
}

/**
 * Import templates from JSON — our own export or `extract.py` output.
 * Accepts `{ templates: { slug: seqs[] } }` or `{ words: [{ slug, sequences }] }`.
 * Invalid sequences are dropped; valid ones replace that word's templates.
 * Returns the merged store and a count of words imported.
 */
export function importWordTemplatesJson(
  store: WordTemplateStore,
  json: string,
): { store: WordTemplateStore; imported: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { store, imported: 0 };
  }
  const incoming: Record<string, Sequence[]> = {};
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (obj.templates && typeof obj.templates === "object") {
      for (const [slug, seqs] of Object.entries(obj.templates as Record<string, unknown>)) {
        if (Array.isArray(seqs) && seqs.every(validSequence)) incoming[slug] = seqs.map((s) => resampleFrames(s as Sequence));
      }
    }
    if (Array.isArray(obj.words)) {
      for (const w of obj.words as Array<{ slug?: unknown; sequences?: unknown }>) {
        if (typeof w?.slug === "string" && Array.isArray(w.sequences) && w.sequences.every(validSequence)) {
          incoming[w.slug] = (w.sequences as Sequence[]).map((s) => resampleFrames(s));
        }
      }
    }
  }
  const words = Object.keys(incoming);
  if (words.length === 0) return { store, imported: 0 };
  const next: WordTemplateStore = {
    version: VERSION,
    templates: { ...store.templates },
  };
  for (const slug of words) next.templates[slug] = incoming[slug].slice(-MAX_PER_WORD);
  save(next);
  return { store: next, imported: words.length };
}

/** Download the whole store as `word-templates.json`. */
export function exportWordTemplates(store: WordTemplateStore): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(store)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "word-templates.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** RESAMPLE_LEN re-exported for the test page's recording budget. */
export { RESAMPLE_LEN };
