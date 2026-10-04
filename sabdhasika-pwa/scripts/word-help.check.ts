import { POST } from "@/app/api/word-help/route";
import { cacheKeyFor, isWordHelpConfigured } from "@/lib/ai/helpProvider";

/**
 * The Word Help endpoint.
 *
 * The point of these checks is the privacy boundary. This route is the first
 * thing in the app that sends anything anywhere, and the guarantee worth
 * defending is not "it explains words well" but "it cannot send a learner's
 * history to a server even by accident".
 */

// No key configured, so nothing is ever dispatched anywhere.
delete process.env.WORD_HELP_API_KEY;
delete process.env.WORD_HELP_BASE_URL;

export async function checkWordHelpRoute(
  check: (name: string, condition: boolean, detail?: unknown) => void,
): Promise<void> {
  const post = async (body: unknown) => {
    const res = await POST(
      new Request("http://localhost/api/word-help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const base = {
    wordId: "ja-1",
    word: "の",
    meaning: "of, 's (possessive particle)",
    partOfSpeech: "particle",
    nativeLanguage: "ne",
    targetLanguage: "ja",
    exampleNative: "日本の本",
    exampleTranslation: "a book of Japan",
  };

  // The learner's own state must be rejected outright, not silently ignored.
  for (const field of ["progress", "streak", "sessions", "recallLog", "bookmarks", "state"]) {
    const r = await post({ ...base, [field]: { anything: true } });
    check(`rejects "${field}"`, r.status === 400, r.status);
  }

  check("unconfigured deployment reports 503", isWordHelpConfigured() === false);
  const unconfigured = await post(base);
  check("and the route answers 503", unconfigured.status === 503, unconfigured.status);
  check(
    "and never returns help content",
    (unconfigured.body as { explanation?: string })?.explanation === undefined,
  );

  const nonJson = await POST(
    new Request("http://localhost/api/word-help", { method: "POST", body: "not json" }),
  );
  check("rejects a non-JSON body", nonJson.status === 400, nonJson.status);
  check("rejects a non-object body", (await post(["array"])).status === 400);
  check("rejects a missing word", (await post({ ...base, word: "" })).status === 400);
  check("rejects a missing meaning", (await post({ ...base, meaning: "" })).status === 400);
  check(
    "rejects an unknown language",
    (await post({ ...base, targetLanguage: "klingon" })).status === 400,
  );
  check("rejects an overlong word", (await post({ ...base, word: "x".repeat(500) })).status === 400);

  // The cache key is what decides whose answer is reused. If it could vary per
  // learner, one person's cached help could be served to another.
  const req = {
    wordId: "ja-1",
    word: "の",
    meaning: "of",
    nativeLanguage: "ne" as const,
    nativeLanguageName: "Nepali",
    targetLanguage: "ja" as const,
    targetLanguageName: "Japanese",
  };
  check("cache key ignores the internal word id", cacheKeyFor(req) === cacheKeyFor({ ...req, wordId: "other" }));
  check(
    "cache key changes with the meaning",
    cacheKeyFor(req) !== cacheKeyFor({ ...req, meaning: "possessive" }),
  );
}