/**
 * Migration + scheduler verification.
 *
 * Run with: npx tsx scripts/verify.ts   (or: npm run verify)
 *
 * Deliberately dependency-free — the project has no test runner, and adding
 * one to check a pure function would be heavier than the check itself.
 * Every import here is the real module the app ships.
 */
import { migrate, STATE_VERSION } from "@/lib/state";
import { getWord, getVocabulary } from "@/lib/data";
import { wordId } from "@/lib/data/build";
import { applyRating, forgettingSoon, isDue, retrievability } from "@/lib/engine/scheduler";
import { buildReviewBuckets } from "@/lib/engine/stats";
import { spokenAnswerQuality } from "@/components/learn/SpeakButton";
import { buildDailySession, estimateCapacity } from "@/lib/engine/session";
import { defaultState } from "@/lib/state";
import type { AppState, DailySession, Rating } from "@/lib/types";
import { checkWordHelpRoute } from "./word-help.check";
import { checkAslTrack } from "./asl.check";
import { checkSignRecognition } from "./sign.check";
import { checkWordDtw } from "./word-dtw.check";
import { checkSlTemplates } from "./sl-templates.check";
import { checkWordModel } from "./word-model.check";
import { progress, v2State } from "./fixtures";

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  checks++;
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(
      `  FAIL ${name}${detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`,
    );
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

async function main() {

/* ------------------------------------------------------------------ *
 * 1. Ids are stable and unique
 * ------------------------------------------------------------------ */
section("word ids");
{
  const langs = ["ja", "ko", "zh", "es", "fr", "de", "ne", "hi", "ar", "ru"] as const;
  const seen = new Map<string, string>();
  let collisions = 0;
  for (const lang of langs) {
    for (const w of getVocabulary(lang)) {
      const prior = seen.get(w.id);
      if (prior) {
        collisions++;
        console.log(`       collision: ${prior} vs ${w.word} (${lang})`);
      }
      seen.set(w.id, `${lang}:${w.word}`);
    }
  }
  check(`no id collisions across ${seen.size} words in ${langs.length} languages`, collisions === 0);
  check("every syllabus is non-empty", langs.every((l) => getVocabulary(l).length > 0));

  // A hash can be all digits, so shape alone cannot tell a stable id from a
  // positional one. Assert the property that actually matters instead: the id
  // is a function of the written form alone, so re-deriving it from the word
  // must reproduce the stored id exactly.
  const ja = getVocabulary("ja");
  let derived = 0;
  for (const w of ja) {
    if (wordId("ja", w.word) === w.id) derived++;
  }
  check("every id is reproducible from the written form alone", derived === ja.length, `${derived}/${ja.length}`);

  // Two different words must never collide, and the same word must never
  // produce two ids — both would silently corrupt a learner's progress map.
  // "en" is not a learning language, but `wordId` only needs the prefix to
  // namespace, and this exercises case/whitespace folding directly.
  check("id is case-insensitive on the written form", wordId("ja", "Apple") === wordId("ja", " apple "));
}

/* ------------------------------------------------------------------ *
 * 2. v2 -> v3 preserves everything
 * ------------------------------------------------------------------ */
section("v2 -> v3 migration");
{
  const before = v2State();
  const after = migrate(before);

  check("version bumped to 3", after.version === STATE_VERSION, `got ${after.version}`);
  check(
    "no progress record was dropped",
    Object.keys(after.progress).length === Object.keys(before.progress).length,
    `${Object.keys(before.progress).length} -> ${Object.keys(after.progress).length}`,
  );

  // Every migrated id must be a real word, and every record's inner wordId
  // must agree with the key it is filed under.
  let mismatched = 0;
  let unknown = 0;
  for (const [id, record] of Object.entries(after.progress)) {
    if (record.wordId !== id) mismatched++;
    if (!getWord(id)) unknown++;
  }
  check("inner wordId agrees with its key", mismatched === 0, `${mismatched} mismatched`);
  check("every migrated id resolves to a real word", unknown === 0, `${unknown} unknown`);

  // Progress must be *preserved*, not just present. Look the word up by its
  // corpus rank, since the old positional id no longer resolves to anything.
  const ja19 = getVocabulary("ja").find((w) => w.frequencyRank === 19);
  const record = ja19 ? after.progress[ja19.id] : undefined;
  check("the rank-19 record survived", Boolean(record));
  check(
    "and kept its repetitions intact",
    record?.repetitions === 7,
    `repetitions=${record?.repetitions}`,
  );
  check("and kept its scheduling fields", record?.nextReviewAt === "2026-09-26T00:00:00.000Z");

  check("settings carried over", after.settings.targetLanguage === "ja" && after.settings.theme === "dark");
  check("onboarding date kept", after.onboardedAt === before.onboardedAt);
  check("streak untouched", after.streak.current === 12 && after.streak.longest === 30);
  check("celebrated milestones kept (no double celebration)", after.celebratedMilestones.join() === "100,250");
  check("bookmarks remapped, none lost", after.bookmarks.length === 2, `got ${after.bookmarks.length}`);

  const session = Object.values(after.sessions)[0];
  check("today's session survived", Boolean(session));
  check("session word count preserved", session?.wordIds.length === 3, `got ${session?.wordIds.length}`);
  check("rating keys preserved (both passes)", Object.keys(session?.ratings ?? {}).length === 3, `got ${Object.keys(session?.ratings ?? {}).length}`);
  check("deferrals preserved", Object.values(session?.deferrals ?? {})[0] === 2);
  check("recall modes preserved", Object.keys(session?.modes ?? {}).length === 2);

  // Every rating key must still point at a word that is in the session.
  const inSession = new Set(session?.wordIds ?? []);
  const orphanRatings = Object.keys(session?.ratings ?? {}).filter(
    (k) => !inSession.has(k.slice(0, k.lastIndexOf("#"))),
  );
  check("no orphaned rating keys", orphanRatings.length === 0, orphanRatings.join(", "));

  check("recall log remapped", after.recallLog.length === 1 && Boolean(getWord(after.recallLog[0].wordId)));
}

/* ------------------------------------------------------------------ *
 * 3. The migration is forgiving, not fatal
 * ------------------------------------------------------------------ */
section("v2 -> v3 resilience");
{
  const broken = v2State();
  broken.progress["zz-9999"] = progress("zz-9999");

  let threw = false;
  let result: AppState | null = null;
  try {
    result = migrate(broken);
  } catch {
    threw = true;
  }
  check("an unresolvable id does not throw", !threw);
  check("an unresolvable id is dropped, others survive", Boolean(result) && Object.keys(result!.progress).length === 3);
}

{
  // A v1 blob must still wipe, because those records really are meaningless.
  const v1 = v2State();
  v1.version = 1;
  const after = migrate(v1);
  check("v1 still wipes positional records", Object.keys(after.progress).length === 0);
  check("v1 keeps the streak", after.streak.current === 12);
  check("v1 keeps milestones", after.celebratedMilestones.length === 2);
}

{
  const after = migrate(null);
  check("null state yields defaults", after.version === STATE_VERSION && Object.keys(after.progress).length === 0);
  const afterJunk = migrate({ nonsense: true });
  check("junk state yields defaults", afterJunk.version === STATE_VERSION);
}

/* ------------------------------------------------------------------ *
 * 4. Idempotence — migrating twice must change nothing
 * ------------------------------------------------------------------ */
section("idempotence");
{
  const once = migrate(v2State());
  const twice = migrate(once);
  check(
    "migrate(migrate(x)) is a fixed point",
    JSON.stringify(once) === JSON.stringify(twice),
  );
}

/* ------------------------------------------------------------------ *
 * 5. Stability across a simulated corpus re-rank
 * ------------------------------------------------------------------ */
section("id stability under re-ranking");
{
  // The whole point of the change. Simulate the corpus being rebuilt and
  // re-ranked — the exact event that forced the destructive v1 -> v2 wipe —
  // and assert every learner's ids survive it untouched.
  const before = getVocabulary("ja");
  const idsBefore = new Map(before.map((w) => [w.word, w.id]));

  // A genuine re-rank: reverse the order and hand every word a new rank.
  // Reversing alone would prove nothing, since each object carries its own
  // rank along with it.
  const after = [...before]
    .reverse()
    .map((w, i) => ({ ...w, frequencyRank: i + 1 }));

  const rankMoved = after.filter((w) => idsBefore.has(w.word)).length;
  const ranksDiffer = after.every(
    (w) => {
      const original = before.find((b) => b.word === w.word);
      return original && original.frequencyRank !== w.frequencyRank;
    },
  );

  check("the re-rank actually moved every word", rankMoved === after.length && ranksDiffer);

  let preserved = 0;
  for (const w of after) {
    if (wordId("ja", w.word) === idsBefore.get(w.word)) preserved++;
  }
  check(
    "every id survives a full re-rank",
    preserved === after.length,
    `${preserved}/${after.length}`,
  );
  check(
    "ids no longer encode rank",
    !before.some((w) => w.id === `ja-${w.frequencyRank}`),
  );
}

/* ------------------------------------------------------------------ *
 * 6. FSRS scheduling behaviour
 * ------------------------------------------------------------------ */
section("FSRS scheduler");
{
  const day = 24 * 60 * 60 * 1000;
  const t0 = new Date("2026-01-01T09:00:00.000Z");

  // First look. Ratings must be graded, not uniform.
  const fresh = (r: Rating) => applyRating(undefined, "ja-x", r, t0);
  const hard = fresh("hard");
  const good = fresh("good");
  const easy = fresh("easy");
  check(
    "first intervals are graded Hard < Good < Easy",
    hard.intervalDays < good.intervalDays && good.intervalDays < easy.intervalDays,
    `${hard.intervalDays} < ${good.intervalDays} < ${easy.intervalDays}`,
  );
  check("a fresh word has no retrievability decay yet", retrievability(good, t0) === 1);
  check("a fresh word is 'learning'", hard.status === "learning");

  // A word rated Hard on its first look must genuinely come back today —
  // this is what the old half-day step existed for.
  check("Hard returns within the same day", good.intervalDays >= 0.5 && hard.intervalDays <= 1);

  // Repeated Easy ratings must compound, not stall.
  let p = fresh("easy");
  const intervals: number[] = [];
  for (let i = 0; i < 5; i++) {
    const next = applyRating(p, "ja-x", "easy", new Date(t0.getTime() + p.intervalDays * day + day));
    intervals.push(next.intervalDays);
    p = next;
  }
  const growing = intervals.every((v, i) => i === 0 || v > intervals[i - 1]);
  check("repeated Easy compounds the interval", growing, intervals.join(" -> "));
  check("Easy eventually reaches a multi-week interval", p.intervalDays > 14, `${p.intervalDays}d`);

  // Repeated Hard must NOT compound into a long interval.
  let q = fresh("hard");
  const hardIntervals: number[] = [];
  for (let i = 0; i < 5; i++) {
    const next = applyRating(q, "ja-x", "hard", new Date(t0.getTime() + q.intervalDays * day + day));
    hardIntervals.push(next.intervalDays);
    q = next;
  }
  check(
    "repeated Hard never reaches a long interval",
    q.intervalDays < good.intervalDays * 4,
    `ended at ${q.intervalDays}d`,
  );
  check("a consistently Hard word is never 'mastered'", q.status !== "mastered");

  // A word that is always Easy should become mastered.
  let r = fresh("easy");
  for (let i = 0; i < 6; i++) {
    r = applyRating(r, "ja-x", "easy", new Date(t0.getTime() + r.intervalDays * day + day));
  }
  check("a consistently Easy word becomes mastered", r.status === "mastered", r.status);

  // Retrievability must decay monotonically with elapsed time.
  let s = fresh("easy");
  s = applyRating(s, "ja-x", "easy", new Date(t0.getTime() + day));
  const reviewedAt = new Date(s.lastReviewedAt!).getTime();
  const decay = [0, 1, 3, 7, 14, 60, 365].map((d) =>
    retrievability(s, new Date(reviewedAt + d * day)),
  );
  const monotonic = decay.every((v, i) => i === 0 || v <= decay[i - 1]);
  check("retrievability decays monotonically over time", monotonic, decay.map((n) => n.toFixed(3)).join(" > "));
  check("retrievability is 1 immediately after review", decay[0] === 1);
  // An Easy-rated word holds for weeks by design — that is the whole point of
  // a strong recall. Only a horizon far beyond its stability should fall away.
  check("a strong word still holds after a month", decay[5] > 0.7, decay[5].toFixed(3));
  check("retrievability does eventually decay", decay[6] < decay[5], decay[6].toFixed(3));
}

section("forgettingSoon");
{
  const day = 24 * 60 * 60 * 1000;
  const t0 = new Date("2026-01-01T09:00:00.000Z");

  // Two words reviewed today, one Easy (will hold) and one Hard (will slip).
  // Both are *not yet due* — that is the whole point, since a word is only ever
  // at 90% recall at its due date, and flagging those would just duplicate
  // "due today".
  const secure = applyRating(undefined, "secure", "easy", t0);
  const fragile = applyRating(undefined, "fragile", "hard", t0);
  check(
    "neither word is due yet",
    !isDue(secure, t0) && !isDue(fragile, t0),
    `secure due ${secure.nextReviewAt}, fragile due ${fragile.nextReviewAt}`,
  );

  const now = new Date(t0.getTime() + 1000 * 1000);
  const slipping = forgettingSoon({ secure, fragile }, now);
  const ids = slipping.map((p) => p.wordId);

  check("a fragile word is surfaced", ids.includes("fragile"), ids.join(",") || "(none)");
  check("a secure word is not surfaced", !ids.includes("secure"), ids.join(","));
  check("slipping words sort soonest-first", ids[0] === "fragile", ids.join(","));

  // Due words belong to "due today", not here.
  const overdue = { fragile: { ...fragile, nextReviewAt: new Date(now.getTime() - day).toISOString() } };
  check(
    "an already-due word is not listed as slipping",
    forgettingSoon(overdue, now).length === 0,
  );

  // A word the learner has never met has no memory to lose. Keyed by a
  // misleading name on purpose: the guard reads the record's own wordId, not
  // the key it happens to be filed under.
  const untouched = { ...fragile, wordId: "untouched", repetitions: 0, status: "new" as const };
  check("untouched words are never slipping", forgettingSoon({ untouched }, now).length === 0);

  // The bucket must compose with the rest of the review queue. Use two real
  // syllabus words, since `buildReviewBuckets` walks the shipped vocabulary.
  const vocab = getVocabulary("ja");
  const strongId = vocab[0].id;
  const weakId = vocab[1].id;
  const state = migrate(v2State());
  const secureWord = applyRating(state.progress[strongId], strongId, "easy", t0);
  const slippingWord = applyRating(undefined, weakId, "hard", t0);

  const buckets = buildReviewBuckets(
    {
      ...state,
      progress: { ...state.progress, [strongId]: secureWord, [weakId]: slippingWord },
    },
    now,
  );

  check("'Slipping soon' is the first bucket", buckets[0].id === "slipping");
  check(
    "'Slipping soon' carries the slipping word",
    buckets[0].words.some((w) => w.id === weakId),
    buckets[0].words.map((w) => w.word).join(","),
  );
  check(
    "'Slipping soon' excludes the secure word",
    !buckets[0].words.some((w) => w.id === strongId),
  );
  check("all five buckets are present", buckets.length === 5, String(buckets.length));
}

/* ------------------------------------------------------------------ *
 * 7. Adaptive session volume
 * ------------------------------------------------------------------ */
section("estimateCapacity");
{
  const now = new Date("2026-02-01T09:00:00.000Z");
  const ids = ["a", "b", "c", "d", "e"];
  const easy = () => Array<Rating>(10).fill("easy");
  const hard = () => Array<Rating>(10).fill("hard");

  const history = (days: Rating[][], goal: 10 | 20 | 25 | 30 = 25): AppState => {
    const base = defaultState();
    base.settings.dailyGoal = goal;
    const sessions: Record<string, DailySession> = {};
    days.forEach((ratings, i) => {
      const date = `2026-01-${String(i + 1).padStart(2, "0")}`;
      const ratings_: Record<string, Rating> = {};
      ratings.forEach((v, j) => (ratings_[`${ids[j % ids.length]}#1`] = v));
      sessions[date] = {
        date,
        wordIds: ids,
        newCount: 1,
        reviewCount: 4,
        modes: {},
        ratings: ratings_,
        completedAt: `${date}T20:00:00.000Z`,
      };
    });
    return { ...base, sessions };
  };

  // A brand-new learner told us nothing yet, so we take them at their word.
  check("no history returns the full goal", estimateCapacity(history([]), now) === 25);
  check(
    "a flawless week keeps the full goal",
    estimateCapacity(history([easy(), easy(), easy(), easy(), easy(), easy(), easy()]), now) === 25,
  );

  // The bug this guards: one bad day used to collapse the queue to the floor,
  // erasing weeks of work and reading to the learner as the app giving up.
  const oneBadDay = estimateCapacity(history([easy(), easy(), easy(), easy(), easy(), hard()]), now);
  check(
    "one hard day does not crater the queue",
    oneBadDay >= 18,
    `dropped to ${oneBadDay}`,
  );

  // Sustained difficulty must still shorten the day — that is the feature.
  const roughWeek = estimateCapacity(history([hard(), hard(), hard(), hard(), hard(), hard(), hard()]), now);
  check("a sustained hard week shortens the queue", roughWeek < 25, `${roughWeek}`);

  // Recovery must be gradual and monotone, not a cliff back to the goal.
  const recovery: number[] = [];
  for (let good = 0; good <= 6; good++) {
    const days = [hard(), hard(), hard(), hard(), hard(), hard()];
    for (let i = 0; i < good; i++) days.push(easy());
    recovery.push(estimateCapacity(history(days), now));
  }
  const monotone = recovery.every((v, i) => i === 0 || v >= recovery[i - 1]);
  check("recovery is gradual, never a cliff", monotone, recovery.join(" -> "));
  check("recovery reaches the goal", recovery[6] === 25, recovery.join(" -> "));

  // Bounds, for every selectable goal.
  let outOfBounds = 0;
  for (const goal of [10, 20, 25, 30] as const) {
    for (const days of [[], [hard(), hard(), hard()], [easy(), easy()], [hard(), easy(), hard()]]) {
      const v = estimateCapacity(history(days, goal), now);
      if (v > goal || v < 8) outOfBounds++;
    }
  }
  check("never exceeds the goal or falls below the floor", outOfBounds === 0, `${outOfBounds} violations`);

  // Review sessions must not be mistaken for daily study.
  const reviewOnly = defaultState();
  const withReview: AppState = {
    ...reviewOnly,
    sessions: {
      "2026-01-01": {
        ...(history([hard()]).sessions["2026-01-01"]),
        isReview: true,
      },
    },
  };
  check(
    "practice runs do not shrink the day",
    estimateCapacity(withReview, now) === 25,
    `${estimateCapacity(withReview, now)}`,
  );

  // Deterministic: the same state must always give the same queue, or the
  // day's words would change under the learner mid-session.
  const s = history([hard(), easy(), hard()]);
  const runs = [0, 1, 2].map(() => estimateCapacity(s, now));
  check("deterministic across calls", new Set(runs).size === 1, runs.join(","));

  // And the queue the learner actually gets must follow.
  const easyPlan = buildDailySession(history([easy(), easy(), easy(), easy(), easy(), easy()], 25), now);
  const hardPlan = buildDailySession(history([hard(), hard(), hard(), hard(), hard(), hard()], 25), now);
  check(
    "the built queue is shorter on a hard week",
    hardPlan.session.wordIds.length < easyPlan.session.wordIds.length,
    `${hardPlan.session.wordIds.length} < ${easyPlan.session.wordIds.length}`,
  );
  check(
    "the built queue never exceeds the goal",
    easyPlan.session.wordIds.length <= 25,
    `${easyPlan.session.wordIds.length}`,
  );
}

/* ------------------------------------------------------------------ *
 * 8. Spoken-answer scoring
 * ------------------------------------------------------------------ */
section("spokenAnswerQuality");
{
  // The accepted forms of a Japanese verb: script, reading, romanization and
  // gloss — exactly what typing already accepts.
  const jp = ["食べる", "たべる", "taberu", "to eat"];

  check("an exact romanization is exact", spokenAnswerQuality("taberu", jp) === "exact");
  check("the script is exact", spokenAnswerQuality("食べる", jp) === "exact");
  check("the reading is exact", spokenAnswerQuality("たべる", jp) === "exact");
  check("case and padding are ignored", spokenAnswerQuality("  Taberu ", jp) === "exact");

  // One edit either way is a near-miss, not a failure: recognition mangles
  // words constantly, and marking those wrong would punish the technology
  // rather than the learner.
  check("one substitution is a near-miss", spokenAnswerQuality("tabero", jp) === "near");
  check("one deletion is a near-miss", spokenAnswerQuality("tabru", jp) === "near");
  check("one insertion is a near-miss", spokenAnswerQuality("taberuu", jp) === "near");

  check("two edits is a miss", spokenAnswerQuality("tabe", jp) === "miss");
  check("an unrelated word is a miss", spokenAnswerQuality("pizza", jp) === "miss");
  check("silence is a miss", spokenAnswerQuality("", jp) === "miss");
  check("whitespace is a miss", spokenAnswerQuality("   ", jp) === "miss");
  check("three edits is a miss", spokenAnswerQuality("taberuuu", jp) === "miss");

  // Diacritics must fold exactly as typing already does, so a Spanish or
  // German learner is not marked wrong for omitting an accent the recogniser
  // may have dropped.
  check(
    "a missing accent still matches",
    spokenAnswerQuality("ubeda", ["úbeda", "ubeda"]) === "exact",
    "expected the accented form to fold",
  );
  check(
    "an added accent still matches",
    spokenAnswerQuality("úbeda", ["ubeda"]) === "exact",
  );

  // Must never throw, whatever it is handed.
  let threw = false;
  try {
    spokenAnswerQuality("anything", []);
    spokenAnswerQuality("", []);
    spokenAnswerQuality("x", ["", "  "]);
  } catch {
    threw = true;
  }
  check("never throws on empty or blank input", !threw);
  check("an empty accepted list yields a miss", spokenAnswerQuality("anything", []) === "miss");
}

/* ------------------------------------------------------------------ *
 * 9. Word Help — the privacy boundary
 * ------------------------------------------------------------------ */
section("word-help route");
{
  await checkWordHelpRoute(check);
}

/* ------------------------------------------------------------------ *
 * 10. The ASL track
 * ------------------------------------------------------------------ */
section("ASL track");
{
  await checkAslTrack(check);
}

/* ------------------------------------------------------------------ *
 * 11. Fingerspelling recognition
 * ------------------------------------------------------------------ */
section("sign recognition");
checkSignRecognition(check);

/* ------------------------------------------------------------------ *
 * 12. Word-sign DTW scorer
 * ------------------------------------------------------------------ */
section("word-sign dtw");
checkWordDtw(check);

/* ------------------------------------------------------------------ *
 * 13. SL-derived word templates
 * ------------------------------------------------------------------ */
section("sl templates");
checkSlTemplates(check);

/* ------------------------------------------------------------------ *
 * 14. Word-sign LSTM classifier
 * ------------------------------------------------------------------ */
section("word model");
checkWordModel(check);

console.log(`\n${failures === 0 ? "PASS" : "FAIL"} — ${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
}

main();