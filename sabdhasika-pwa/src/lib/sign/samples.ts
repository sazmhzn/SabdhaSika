/**
 * Captured training samples.
 *
 * Each sample is one frame's feature vector plus the letter it was signed as.
 * They live in `localStorage` because they are small (a few hundred KB for a
 * full alphabet) and must survive a reload while you record — losing a
 * half-finished recording to an accidental refresh would be maddening.
 *
 * Nothing here is sent anywhere. The export is a local file download that you
 * hand to `scripts/train-sign-model.mjs`.
 */

import { FEATURE_DIM } from "@/lib/sign/features";

const STORAGE_KEY = "sabdhasika:sign-samples";
const VERSION = 1;

export interface SignSample {
  label: string;
  values: number[];
}

export interface SampleSet {
  version: number;
  featureDim: number;
  samples: SignSample[];
}

const EMPTY: SampleSet = { version: VERSION, featureDim: FEATURE_DIM, samples: [] };

/** Letters the recogniser can classify — the manual alphabet without J and Z. */
export const TRAINABLE_LETTERS: readonly string[] = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

function isSample(value: unknown): value is SignSample {
  if (!value || typeof value !== "object") return false;
  const s = value as SignSample;
  return (
    typeof s.label === "string" &&
    Array.isArray(s.values) &&
    s.values.length === FEATURE_DIM &&
    s.values.every((v) => Number.isFinite(v))
  );
}

export function loadSamples(): SampleSet {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as SampleSet;
    if (!parsed || !Array.isArray(parsed.samples)) return EMPTY;
    return {
      version: VERSION,
      featureDim: FEATURE_DIM,
      samples: parsed.samples.filter(isSample),
    };
  } catch {
    return EMPTY;
  }
}

export function saveSamples(set: SampleSet): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(set));
  } catch {
    /* quota or private mode — the in-memory copy is still usable */
  }
}

export function addSamples(set: SampleSet, label: string, frames: number[][]): SampleSet {
  const next: SampleSet = {
    version: VERSION,
    featureDim: FEATURE_DIM,
    samples: [...set.samples, ...frames.filter((v) => v.length === FEATURE_DIM).map((values) => ({ label, values }))],
  };
  saveSamples(next);
  return next;
}

export function clearLabel(set: SampleSet, label: string): SampleSet {
  const next: SampleSet = { ...set, samples: set.samples.filter((s) => s.label !== label) };
  saveSamples(next);
  return next;
}

export function clearAll(): SampleSet {
  saveSamples(EMPTY);
  return EMPTY;
}

export function countByLabel(set: SampleSet): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of set.samples) counts[s.label] = (counts[s.label] ?? 0) + 1;
  return counts;
}

/** Download the whole set as `sign-samples.json`. */
export function exportSamples(set: SampleSet): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(set)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sign-samples.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
