import { getVocabulary, getWord } from "@/lib/data";
import { ASL, FINGERSPELLING, NUMBERS, REST_POSITION, handshapeFor } from "@/lib/data/asl";
import { buildDailySession, buildReviewSession } from "@/lib/engine/session";
import { frequencyListSize, SPOKEN_LANGUAGES } from "@/lib/data/frequency";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { defaultState } from "@/lib/state";
import type { AppState, LanguageCode } from "@/lib/types";

type Check = (name: string, condition: boolean, detail?: unknown) => void;

function aslState(): AppState {
  const base = defaultState();
  return { ...base, settings: { ...base.settings, targetLanguage: "asl" } };
}

/**
 * The ASL track.
 *
 * Two things are being defended here. First, honesty: a signed language must
 * never report a corpus rank it does not have, and must never be labelled as
 * something it is not. Second, containment: every spoken-language assumption in
 * the engine — frequency ordering, speech modes — has to stay true for the ten
 * languages that do have those things.
 */
export async function checkAslTrack(check: Check): Promise<void> {
  const asl = getLanguage("asl");
  check("ASL is in the registry", Boolean(asl));
  check("ASL declares itself signed", asl?.modality === "signed", asl?.modality);
  check("ASL has no speech voice tag", asl?.bcp47 === null, asl?.bcp47);
  check(
    "ASL is named in full, never as another sign language",
    asl?.name === "American Sign Language",
    asl?.name,
  );
  check(
    "every language states its modality",
    LANGUAGES.every((l) => l.modality === "spoken" || l.modality === "signed"),
  );
  check(
    "ASL is the only signed track",
    LANGUAGES.filter((l) => l.modality === "signed").map((l) => l.code).join() === "asl",
  );
  check(
    "every spoken language keeps a voice tag",
    LANGUAGES.filter((l) => l.modality === "spoken").every((l) => typeof l.bcp47 === "string"),
  );

  // A signed language must not fabricate corpus facts.
  check("ASL reports no corpus size", frequencyListSize("asl") === 0);
  check("ASL is excluded from the spoken set", !(SPOKEN_LANGUAGES as string[]).includes("asl"));
  check("a spoken language still reports its real size", frequencyListSize("ja") > 0);

  check("the manual alphabet is complete", FINGERSPELLING.length === 26, FINGERSPELLING.length);
  check(
    "every letter A-Z appears exactly once",
    FINGERSPELLING.map((h) => h.symbol).join("") === "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  );
  check("all ten number handshapes exist", NUMBERS.length === 10, NUMBERS.length);
  check("a rest position exists", REST_POSITION.resting === true);
  check("no duplicate syllabus symbols", new Set(ASL.map((w) => w.word)).size === ASL.length);
  check("ordinals run 1..n with no gaps", ASL.every((w, i) => w.syllabusOrdinal === i + 1));
  check(
    "no entry fabricates a frequency rank",
    ASL.every((w) => w.frequencyRank === 0),
  );
  check("every entry explains the handshape", ASL.every((w) => Boolean(w.handshape.cue)));
  check("every entry says how to check it", ASL.every((w) => Boolean(w.handshape.check)));
  check("every entry has a spoken name", ASL.every((w) => Boolean(w.romanized)));
  check("an unknown symbol resolves to nothing", handshapeFor("&") === undefined);

  // Ordering: ordinal for a signed track, rank for everything else.
  const vocab = getVocabulary("asl");
  check("the ASL syllabus is non-empty", vocab.length > 0, vocab.length);
  check("ASL sorts by ordinal", vocab.every((w, i) => w.syllabusOrdinal === i + 1));
  check("ASL ids resolve", Boolean(getWord(vocab[0].id)));

  const plan = buildDailySession(aslState(), new Date("2026-03-01T09:00:00.000Z"));
  check("an ASL session builds a queue", plan.session.wordIds.length > 0);
  check(
    "an ASL session never offers a speech mode",
    Object.values(plan.session.modes).every((m) => m !== "listen" && m !== "speak"),
    Object.values(plan.session.modes),
  );
  const review = buildReviewSession(
    aslState(),
    plan.session.wordIds.slice(0, 6),
    new Date("2026-03-01T09:00:00.000Z"),
  );
  check(
    "an ASL practice run never offers a speech mode",
    Object.values(review.session.modes).every((m) => m !== "listen" && m !== "speak"),
  );

  // Containment: the spoken tracks must be entirely unaffected.
  for (const lang of ["ja", "ne", "hi", "ru"] as LanguageCode[]) {
    const base = defaultState();
    const state: AppState = { ...base, settings: { ...base.settings, targetLanguage: lang } };
    const built = buildDailySession(state, new Date("2026-03-01T09:00:00.000Z"));
    check(`${lang} still builds a queue`, built.session.wordIds.length > 0);
    const list = getVocabulary(lang);
    check(
      `${lang} still sorts by frequency rank`,
      list.every((w, i) => i === 0 || w.frequencyRank >= list[i - 1].frequencyRank),
    );
    check(`${lang} words carry no ordinal`, list.every((w) => w.syllabusOrdinal === undefined));
  }
}