import { NextResponse } from "next/server";
import {
  cacheKeyFor,
  fetchWordHelp,
  isWordHelpConfigured,
  type WordHelpRequest,
  type WordHelpResponse,
} from "@/lib/ai/helpProvider";

export const runtime = "nodejs";

/**
 * Word Help — one word, one explanation.
 *
 * The most important property of this route is what it does *not* accept. The
 * request body is validated against `WordHelpRequest`, which has no field for
 * progress, streak, sessions, recall history, bookmarks or account identity.
 * Those are rejected rather than ignored, so a future caller cannot quietly
 * start shipping them.
 */

export const maxDuration = 20;

/** Small in-process cache. Explanations for a word do not change. */
const CACHE = new Map<string, WordHelpResponse>();
const CACHE_LIMIT = 500;

const LANGUAGE_NAMES: Record<string, string> = {
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  es: "Spanish",
  fr: "French",
  de: "German",
  ne: "Nepali",
  hi: "Hindi",
  ar: "Arabic",
  ru: "Russian",
  en: "English",
  pt: "Portuguese",
  it: "Italian",
  bn: "Bengali",
  id: "Indonesian",
  tr: "Turkish",
  vi: "Vietnamese",
};

const VALID_TARGET = new Set(Object.keys(LANGUAGE_NAMES));

/** Fields that must never appear in the body. Named explicitly so the
 *  rejection is a deliberate act rather than a side effect of allowlisting. */
const FORBIDDEN = ["progress", "streak", "sessions", "recallLog", "bookmarks", "state"];

function str(v: unknown, max = 400): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > max) return undefined;
  return trimmed;
}

export async function POST(request: Request) {
  // Validate *before* checking configuration. The order matters: the guard
  // against forbidden fields has to run on every request so it is a property of
  // the endpoint rather than something that quietly disappears when no key is
  // set up. Short-circuiting here would leave the privacy boundary untested in
  // exactly the deployments where nobody is watching.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  for (const field of FORBIDDEN) {
    if (field in raw) {
      return NextResponse.json(
        { error: `Unexpected field "${field}". This endpoint takes one word and nothing else.` },
        { status: 400 },
      );
    }
  }

  const targetLanguage = str(raw.targetLanguage, 8) ?? "";
  const nativeLanguage = str(raw.nativeLanguage, 8) ?? "";
  const word = str(raw.word, 64);
  const meaning = str(raw.meaning, 300);

  if (!VALID_TARGET.has(targetLanguage) || !VALID_TARGET.has(nativeLanguage)) {
    return NextResponse.json({ error: "Unknown language." }, { status: 400 });
  }
  if (!word || !meaning) {
    return NextResponse.json({ error: "A word and a meaning are required." }, { status: 400 });
  }

  if (!isWordHelpConfigured()) {
    return NextResponse.json(
      { error: "Word Help is not configured on this deployment." },
      { status: 503 },
    );
  }

  const exampleNative = str(raw.exampleNative, 300);
  const exampleTranslation = str(raw.exampleTranslation, 300);

  const req: WordHelpRequest = {
    wordId: str(raw.wordId, 64) ?? word,
    word,
    meaning,
    partOfSpeech: str(raw.partOfSpeech, 40),
    nativeLanguage: nativeLanguage as WordHelpRequest["nativeLanguage"],
    nativeLanguageName: LANGUAGE_NAMES[nativeLanguage],
    targetLanguage: targetLanguage as WordHelpRequest["targetLanguage"],
    targetLanguageName: LANGUAGE_NAMES[targetLanguage],
    example:
      exampleNative && exampleTranslation
        ? { native: exampleNative, translation: exampleTranslation }
        : undefined,
  };

  const key = cacheKeyFor(req);
  const cached = CACHE.get(key);
  if (cached) return NextResponse.json(cached);

  // The controller is gone if the client navigates away, so nothing is held
  // open waiting for a learner who has already left.
  const help = await fetchWordHelp(req, request.signal);

  if (!help) {
    // A failure here is normal, not exceptional: no key, a network error, or a
    // reply that could not be parsed. The card falls back to the static example
    // it already has, so the learner sees nothing break.
    return NextResponse.json({ error: "No help available." }, { status: 502 });
  }

  if (CACHE.size >= CACHE_LIMIT) {
    // Cheap eviction: these entries never expire, so dropping the oldest third
    // is enough and avoids tracking insertion order.
    const drop = Math.floor(CACHE_LIMIT / 3);
    let n = 0;
    for (const k of CACHE.keys()) {
      CACHE.delete(k);
      if (++n >= drop) break;
    }
  }
  CACHE.set(key, help);

  return NextResponse.json(help);
}