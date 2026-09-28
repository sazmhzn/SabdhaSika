"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PronunciationButton } from "@/components/learn/PronunciationButton";
import { ChoiceOptions, TypeAnswer } from "@/components/learn/RecallInput";
import { RatingBar, RATING_FROM_KEY } from "@/components/learn/RatingBar";
import { Kbd } from "@/components/ui/Kbd";
import { sfx } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { resolveMeaning } from "@/lib/data";
import { buildChoices, checkTypedAnswer, isTypingTarget } from "@/lib/engine/quiz";
import { statusLabel } from "@/lib/engine/scheduler";
import { haptics } from "@/lib/haptics";
import { heroFontSize, isRtl } from "@/lib/romanization";
import type { LanguageMeta } from "@/lib/languages";
import type {
  NativeLanguageCode,
  Rating,
  RecallMode,
  VocabularyWord,
  WordProgress,
} from "@/lib/types";

const SPRING = { type: "spring" as const, stiffness: 300, damping: 32, mass: 0.85 };
const SOFT = { duration: 0.34, ease: [0.16, 1, 0.3, 1] as const };

export interface FlashcardProps {
  word: VocabularyWord;
  vocabulary: VocabularyWord[];
  language: LanguageMeta;
  nativeLanguage: NativeLanguageCode;
  progress?: WordProgress;
  mode: RecallMode;
  pass: 1 | 2;
  /**
   * True when this is the very first time the learner has seen the word.
   * There has been no recall attempt yet, so asking "how well did you
   * remember?" is a question with no answer — the card ends on a single
   * "Got it" instead. The rating bar is reserved for cards where the
   * learner actually had something to remember.
   */
  firstExposure?: boolean;
  showRomanization: boolean;
  showHints: boolean;
  autoPlay: boolean;
  pronunciationEnabled: boolean;
  hapticsEnabled: boolean;
  onRate: (rating: Rating) => void;
  onAnswer?: (correct: boolean) => void;
}

/**
 * The heart of the product.
 *
 * Design notes worth keeping:
 *  · The card has a **fixed minimum height** and never reflows its outer box.
 *    Everything that moves is a transform or an opacity, which is what keeps
 *    the reveal at 60fps on a mid-range phone. A card that re-lays-out on
 *    every tap is the difference between "app" and "web page".
 *  · The reveal is a **focus shift**, not a flip: the word shrinks and rises,
 *    the meaning rises into the space it vacated. Nothing spins.
 *  · Cards the learner has *attempted* end on the same three buttons, so the
 *    rhythm of a session is predictable even though the interaction is not.
 *    A word being met for the first time ends on one button instead — there
 *    is nothing to self-assess yet, and pretending otherwise is the single
 *    most common way a learning app wastes a tap.
 */
export function Flashcard({
  word,
  vocabulary,
  language,
  nativeLanguage,
  progress,
  mode,
  pass,
  firstExposure = false,
  showRomanization,
  showHints,
  autoPlay,
  pronunciationEnabled,
  hapticsEnabled,
  onRate,
  onAnswer,
}: FlashcardProps) {
  const reduce = useReducedMotion();
  const meaning = resolveMeaning(word, nativeLanguage);

  const [revealed, setRevealed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const choices = useMemo(
    () => (mode === "choice" ? buildChoices(word, vocabulary, nativeLanguage, 4) : []),
    [mode, word, vocabulary, nativeLanguage],
  );

  const answered = mode === "reveal" ? revealed : mode === "choice" ? selectedId !== null : false;
  const typedCorrect =
    mode === "type" && typed.trim() ? checkTypedAnswer(typed, word, nativeLanguage) : null;

  const phase: "prompt" | "answer" =
    mode === "reveal"
      ? revealed
        ? "answer"
        : "prompt"
      : mode === "choice"
        ? selectedId
          ? "answer"
          : "prompt"
        : "prompt"; // "type" stays in prompt until the learner submits and rates

  const wasCorrect =
    mode === "choice" ? selectedId === word.id : mode === "type" ? typedCorrect === true : true;

  /* ---------------------------------------------------------------- *
   * Actions
   * ---------------------------------------------------------------- */

  const reveal = useCallback(() => {
    if (revealed) return;
    setRevealed(true);
    haptics.reveal(hapticsEnabled);
    sfx.reveal();
  }, [hapticsEnabled, revealed]);

  const choose = useCallback(
    (id: string) => {
      setSelectedId(id);
      const correct = id === word.id;
      haptics[correct ? "correct" : "incorrect"](hapticsEnabled);
      sfx[correct ? "correct" : "incorrect"]();
      onAnswer?.(correct);
    },
    [hapticsEnabled, onAnswer, word.id],
  );

  const submitTyped = useCallback(() => {
    if (!typed.trim()) return;
    const correct = checkTypedAnswer(typed, word, nativeLanguage);
    haptics[correct ? "correct" : "incorrect"](hapticsEnabled);
    sfx[correct ? "correct" : "incorrect"]();
    onAnswer?.(correct);
  }, [hapticsEnabled, nativeLanguage, onAnswer, typed, word]);

  const rate = useCallback(
    (rating: Rating) => {
      haptics.tick(hapticsEnabled);
      sfx.tap();
      onRate(rating);
    },
    [hapticsEnabled, onRate],
  );

  /* ---------------------------------------------------------------- *
   * Keyboard: Space reveals, 1/2/3 rate, Enter submits a typed answer,
   * and on a first exposure Space/Enter simply moves on.
   * ---------------------------------------------------------------- */
  const ratingVisible =
    !firstExposure &&
    ((mode === "reveal" && revealed) ||
      (mode === "choice" && selectedId !== null) ||
      (mode === "type" && typedCorrect !== null));

  const continueVisible = firstExposure && phase === "answer";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (continueVisible && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        rate("good");
        return;
      }

      if (ratingVisible) {
        const picked = RATING_FROM_KEY[e.key];
        if (picked) {
          e.preventDefault();
          rate(picked);
          return;
        }
      }

      if (phase === "prompt" && (e.key === " " || e.key === "Enter")) {
        if (mode === "reveal") {
          e.preventDefault();
          reveal();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [continueVisible, mode, phase, rate, ratingVisible, reveal]);

  /* ---------------------------------------------------------------- *
   * Auto-play: only ever after the card is on screen, never mid-transition.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (!autoPlay || !pronunciationEnabled) return;
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("sabdhasika:speak", { detail: word.word }));
    }, 320);
    return () => clearTimeout(t);
  }, [autoPlay, pronunciationEnabled, word.word]);

  /* ---------------------------------------------------------------- *
   * Suggested rating: a nudge, never an auto-submit.
   * ---------------------------------------------------------------- */
  const suggested: Rating | null =
    mode === "choice" ? (wasCorrect ? "good" : "hard") : mode === "type" ? (typedCorrect ? "easy" : "hard") : null;

  const status = progress?.status ?? "new";
  const showScript = hasRomanizationData(word);

  return (
    <motion.section
      layout
      transition={{ layout: SPRING }}
      aria-label={`Card: ${word.word}`}
      className={cn(
        "surface-card grain relative isolate flex w-full flex-col overflow-hidden",
        "min-h-[min(66svh,540px)]",
        mode === "reveal" && phase === "prompt" && "cursor-pointer",
      )}
      onClick={mode === "reveal" && phase === "prompt" ? reveal : undefined}
    >
      {/* ── meta row ─────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-line bg-paper/70 px-3 py-1 text-[11px] font-semibold text-muted tabular-nums">
            No. {word.frequencyRank}
          </span>
          {word.partOfSpeech && (
            <span className="hidden rounded-full border border-line bg-paper/70 px-3 py-1 text-[11px] font-medium text-muted sm:inline">
              {word.partOfSpeech}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pass === 2 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent"
            >
              <Sparkles className="size-3" strokeWidth={2.4} />
              One more look
            </motion.span>
          )}
          {pass === 1 && firstExposure && (
            <span className="rounded-full border border-line bg-paper/70 px-3 py-1 text-[11px] font-medium text-muted">
              First look
            </span>
          )}
          {pass === 1 && !firstExposure && status !== "new" && (
            <span className="rounded-full border border-line bg-paper/70 px-3 py-1 text-[11px] font-medium text-muted">
              {statusLabel(status)}
            </span>
          )}
        </div>
      </header>

      {/* ── hero ─────────────────────────────────────────────────── */}
      <motion.div
        layout="position"
        transition={{ layout: SPRING }}
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-4 text-center"
      >
        <motion.div
          animate={
            reduce
              ? { scale: 1, y: 0 }
              : phase === "answer"
                ? { scale: 0.68, y: -6 }
                : { scale: 1, y: 0 }
          }
          transition={SPRING}
          className="flex flex-col items-center"
        >
          {mode === "type" ? (
            /* Production direction: the meaning is the prompt. */
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                Say it in {language.name}
              </span>
              <h2
                className="mt-3 font-extrabold leading-[1.05] tracking-[-0.03em] text-ink"
                style={{ fontSize: "clamp(1.6rem, 6vw, 2.6rem)" }}
              >
                {meaning}
              </h2>
            </>
          ) : (
            <>
              <h2
                dir={isRtl(word.language) ? "rtl" : "ltr"}
                lang={word.language}
                className="font-extrabold leading-[1.02] tracking-[-0.035em] text-ink"
                style={{ fontSize: heroFontSize(word.word) }}
              >
                {word.word}
              </h2>
              {word.reading && word.reading !== word.word && (
                <p
                  lang={word.language}
                  className="mt-3 text-[clamp(0.95rem,3.4vw,1.3rem)] font-medium text-muted"
                >
                  {word.reading}
                </p>
              )}
              {showRomanization && showScript && (
                <p className="mt-1 font-serif text-[clamp(0.95rem,3.2vw,1.25rem)] italic text-faint">
                  {word.romanized}
                </p>
              )}
            </>
          )}
        </motion.div>
      </motion.div>

      {/* ── interaction / answer ─────────────────────────────────── */}
      <div className="relative z-10 px-5 pb-5">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "reveal" && phase === "prompt" && (
            <motion.div
              key="tap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SOFT}
              className="flex flex-col items-center gap-3"
            >
              <span className="hairline w-24" />
              <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
                {firstExposure ? "Tap to meet it" : "Tap to reveal"}
                {showHints && (
                  <span className="hidden items-center gap-1 text-faint sm:inline-flex">
                    <CornerDownLeft className="size-3" strokeWidth={2.2} /> Space
                  </span>
                )}
              </span>
            </motion.div>
          )}

          {mode === "choice" && phase === "prompt" && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SOFT}
            >
              <p className="mb-3 text-center text-[12px] font-medium text-muted">
                What does this mean?
              </p>
              <ChoiceOptions
                choices={choices}
                correctId={word.id}
                selectedId={selectedId}
                onSelect={choose}
              />
            </motion.div>
          )}

          {mode === "type" && (
            <motion.div
              key="type"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SOFT}
            >
              <TypeAnswer
                value={typed}
                onChange={setTyped}
                onSubmit={submitTyped}
                answered={typedCorrect !== null}
                correct={typedCorrect === true}
                prompt={`Type it in ${language.name}`}
                placeholder={language.needsRomanization ? "script, reading or romaji" : "type the word"}
                reveal={[word.word, word.romanized].filter(Boolean).join("  ·  ")}
              />
            </motion.div>
          )}

          {phase === "answer" && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SOFT, delay: 0.06 }}
              className="flex flex-col gap-4"
            >
              {/* meaning */}
              <div className="text-center">
                <p className="text-[clamp(1.25rem,4.6vw,1.7rem)] font-bold leading-tight tracking-[-0.02em] text-ink">
                  {meaning}
                </p>
                {!word.translations?.[nativeLanguage] && nativeLanguage !== "en" && (
                  <p className="mt-1 text-[11px] text-faint">English gloss — no translation yet</p>
                )}
              </div>

              {/* pronunciation */}
              {pronunciationEnabled && (
                <div className="flex justify-center">
                  <PronunciationButton
                    text={word.word}
                    bcp47={language.bcp47}
                    hint={word.pronunciation}
                    hapticsEnabled={hapticsEnabled}
                  />
                </div>
              )}

              {/* example */}
              {word.example && (
                <div className="rounded-panel border border-line bg-paper/60 p-4">
                  <span className="hairline mx-auto mb-3 block w-12" />
                  <p
                    lang={word.language}
                    dir={isRtl(word.language) ? "rtl" : "ltr"}
                    className="text-center text-[15px] font-semibold leading-snug text-ink"
                  >
                    {word.example.native}
                  </p>
                  {word.example.reading && (
                    <p className="mt-1 text-center text-[12px] text-muted">{word.example.reading}</p>
                  )}
                  {showRomanization && word.example.romanized && (
                    <p className="mt-1 text-center font-serif text-[12px] italic text-faint">
                      {word.example.romanized}
                    </p>
                  )}
                  <p className="mt-2 text-center text-[13px] leading-snug text-ink-soft">
                    {word.example.translation}
                  </p>
                </div>
              )}

              {/* The corpus count, on the back where context belongs — the
                  front stays a clean recall prompt. It is the product's claim
                  made concrete: this is how often the learner will actually
                  meet the word. Absent for a rank-only source (Japanese),
                  which publishes no counts to show. */}
              {word.frequency !== undefined && (
                <p className="text-center text-[11.5px] leading-relaxed text-faint">
                  Appears{" "}
                  <span className="font-semibold text-muted tabular-nums">
                    {word.frequency.toLocaleString()}
                  </span>{" "}
                  times in the corpus this list was counted from
                </p>
              )}

              {firstExposure ? (
                /* First look. Nothing to self-assess — one way forward, and
                   one quiet way to ask for the word again later today. */
                <div className="flex flex-col gap-3">
                  <p className="text-center text-[12px] font-medium text-muted">
                    First look. It comes back tomorrow.
                  </p>
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => rate("good")}
                    className="press chrome-noselect inline-flex h-14 w-full items-center justify-center gap-2 rounded-row bg-ink text-[15px] font-semibold text-paper"
                  >
                    Got it
                    <ArrowRight className="size-4" strokeWidth={2.4} />
                    {showHints && (
                      <Kbd className="ml-1 border-transparent bg-paper/15 text-paper/70">↵</Kbd>
                    )}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => rate("hard")}
                    className="press chrome-noselect self-center rounded-chip px-3 py-2 text-[12.5px] font-semibold text-faint hover:text-ink"
                  >
                    Show me again today
                  </button>
                </div>
              ) : (
                <RatingBar onRate={rate} suggested={suggested} showHints={showHints} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Typed answers keep their rating row below the input */}
        {mode === "type" && typedCorrect !== null && (
          <div className="mt-4">
            <RatingBar onRate={rate} suggested={suggested} showHints={showHints} />
          </div>
        )}
      </div>
    </motion.section>
  );
}

function hasRomanizationData(word: VocabularyWord): boolean {
  return Boolean(word.reading || word.romanized);
}
