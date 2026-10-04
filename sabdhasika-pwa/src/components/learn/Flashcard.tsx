"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CornerDownLeft, HelpCircle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PronunciationButton } from "@/components/learn/PronunciationButton";
import { ChoiceOptions, TypeAnswer } from "@/components/learn/RecallInput";
import { SpeakButton, spokenAnswerQuality } from "@/components/learn/SpeakButton";
import { HandShapeDiagram } from "@/components/sign/HandShapeDiagram";
import { RatingBar, RATING_FROM_KEY } from "@/components/learn/RatingBar";
import { Kbd } from "@/components/ui/Kbd";
import { sfx } from "@/lib/audio";
import { useWordHelp } from "@/lib/ai/useWordHelp";
import { cn } from "@/lib/cn";
import { resolveMeaning } from "@/lib/data";
import { handshapeFor } from "@/lib/data/asl";
import { buildChoices, checkTypedAnswer, isTypingTarget } from "@/lib/engine/quiz";
import { statusLabel } from "@/lib/engine/scheduler";
import { haptics } from "@/lib/haptics";
import { startListening, type ListeningSession } from "@/lib/speech-input";
import { heroFontSize, isRtl } from "@/lib/romanization";
import type { LanguageMeta } from "@/lib/languages";
import { getNativeLanguage } from "@/lib/languages";
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
  // Speech input.
  const [listening, setListening] = useState(false);
  const [spokenPartial, setSpokenPartial] = useState("");
  const [spokenQuality, setSpokenQuality] = useState<"exact" | "near" | "miss" | null>(null);
  const [heard, setHeard] = useState("");
  const listenRef = useRef<ListeningSession | null>(null);
  const help = useWordHelp();

  // Help belongs to the word that was asked about. Carrying it to the next
  // card would answer a question nobody asked.
  useEffect(() => help.reset(), [help.reset, word.id]);

  const choices = useMemo(
    () => (mode === "choice" || mode === "listen" ? buildChoices(word, vocabulary, nativeLanguage, 4) : []),
    [mode, word, vocabulary, nativeLanguage],
  );

  // Every form the spoken answer may legitimately take. Reuses exactly the
  // rules typing already accepts, so a word spoken in its romanization is as
  // acceptable as one typed that way.
  const acceptedForms = useMemo(
    () =>
      [word.word, word.reading, word.romanized, meaning].filter(Boolean) as string[],
    [meaning, word.reading, word.romanized, word.word],
  );

  const isListeningMode = mode === "listen";
  const isSpeakingMode = mode === "speak";

  /**
   * A signed language has no voice, so every speech feature on this card is
   * switched off rather than rendered as a control that cannot work: no
   * pronunciation button, no auto-play, no Listen mode, no microphone.
   */
  const isSigned = language.modality === "signed";
  const bcp47 = language.bcp47 ?? "";
  const canSpeak = !isSigned && pronunciationEnabled;
  // Only a sign track has a handshape to draw; a spoken word has none.
  const handshape = isSigned ? handshapeFor(word.word) : undefined;

  /**
   * A Listen card hides the word and asks the learner to recognise audio. With
   * no audio available there is nothing to listen to, which makes the card
   * unanswerable — so it degrades to an ordinary reveal card rather than
   * presenting something the learner cannot possibly do.
   */
  const listenUnusable = isListeningMode && !canSpeak;
  const asReveal = mode === "reveal" || listenUnusable;

  const answered = asReveal
    ? revealed
    : mode === "choice" || isListeningMode
      ? selectedId !== null
      : mode === "type"
        ? typed.trim().length > 0
        : spokenQuality !== null;

  const typedCorrect =
    mode === "type" && typed.trim() ? checkTypedAnswer(typed, word, nativeLanguage) : null;

  const phase: "prompt" | "answer" = answered ? "answer" : "prompt";

  const wasCorrect =
    mode === "choice"
      ? selectedId === word.id
      : mode === "type"
        ? typedCorrect === true
        : isListeningMode
          ? selectedId === word.id
          : spokenQuality === "exact" || spokenQuality === "near";

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

  /* ---------------------------------------------------------------- *
   * Speech input.
   * ---------------------------------------------------------------- */

  const stopListening = useCallback(() => {
    listenRef.current?.stop();
    listenRef.current = null;
    setListening(false);
  }, []);

  // A recogniser left running after the card is gone would keep the microphone
  // open on the next one, so it is stopped on unmount and whenever the word
  // changes.
  useEffect(() => stopListening, [stopListening, word.id]);

  const beginListening = useCallback((): ListeningSession | null => {
    // A signed language has no voice to recognise against, so there is nothing
    // for a microphone to do here.
    if (!bcp47) return null;
    const session = startListening(bcp47, {
      onPartial: (text) => setSpokenPartial(text),
      onFinal: (transcript) => {
        setListening(false);
        setHeard(transcript);
        const quality = spokenAnswerQuality(transcript, acceptedForms);
        setSpokenQuality(quality);
        const good = quality !== "miss";
        haptics[good ? "correct" : "incorrect"](hapticsEnabled);
        sfx[good ? "correct" : "incorrect"]();
        onAnswer?.(good);
      },
      onError: () => {
        setListening(false);
        setSpokenPartial("");
        // A failed microphone is not a wrong answer. Report the card as
        // correct-but-unrated so the learner is never told they got it wrong
        // because the device refused to listen.
        setSpokenQuality(null);
        setSpokenPartial("");
        setHeard("");
      },
    });
    if (session) {
      listenRef.current = session;
      setListening(true);
    }
    return session;
  }, [acceptedForms, hapticsEnabled, bcp47, onAnswer]);

  // Listening mode plays the word instead of showing it. Auto-plays once the
  // card is on screen, and can be replayed — a learner who did not catch it
  // must be able to hear it again, or the question is unanswerable.
  useEffect(() => {
    if (!isListeningMode || !canSpeak) return;
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("sabdhasika:speak", { detail: word.word }));
    }, 300);
    return () => clearTimeout(t);
  }, [isListeningMode, pronunciationEnabled, word.word]);

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
    (asReveal
      ? revealed
      : mode === "choice" || isListeningMode
        ? selectedId !== null
        : mode === "type"
          ? typedCorrect !== null
          : spokenQuality !== null);

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
        if (asReveal) {
          e.preventDefault();
          reveal();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asReveal, continueVisible, mode, phase, rate, ratingVisible, reveal]);

  /* ---------------------------------------------------------------- *
   * Auto-play: only ever after the card is on screen, never mid-transition.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (!autoPlay || !canSpeak) return;
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("sabdhasika:speak", { detail: word.word }));
    }, 320);
    return () => clearTimeout(t);
  }, [autoPlay, pronunciationEnabled, word.word]);

  /* ---------------------------------------------------------------- *
   * Suggested rating: a nudge, never an auto-submit.
   * ---------------------------------------------------------------- */
  const suggested: Rating | null =
    mode === "choice" || isListeningMode
      ? wasCorrect
        ? "good"
        : "hard"
      : mode === "type"
        ? typedCorrect
          ? "easy"
          : "hard"
        : isSpeakingMode && spokenQuality !== null
          ? spokenQuality === "miss"
            ? "hard"
            : spokenQuality === "exact"
              ? "easy"
              : "good"
          : null;

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
        asReveal && phase === "prompt" && "cursor-pointer",
      )}
      onClick={asReveal && phase === "prompt" ? reveal : undefined}
    >
      {/* ── meta row ─────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-2">
          {/* The corpus position, or the teaching position on a sign track.
              Showing "No. 0" on a signed card would report a rank that was
              never computed, so the two are labelled differently. */}
          <span className="rounded-full border border-line bg-paper/70 px-3 py-1 text-[11px] font-semibold text-muted tabular-nums">
            {isSigned
              ? `Step ${word.syllabusOrdinal ?? 1}`
              : `No. ${word.frequencyRank}`}
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
          ) : isListeningMode ? (
            /* Perception direction: the word is audio only. Showing it would
               answer the question before it was asked. */
            <div className="flex flex-col items-center gap-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                What did you hear?
              </span>
              <PronunciationButton
                text={word.word}
                bcp47={bcp47}
                hapticsEnabled={hapticsEnabled}
                size="lg"
              />
            </div>
          ) : isSigned && handshape ? (
            /* A sign is the word. The letter is shown large, with the handshape
               drawn beside it as a labelled diagram. */
            <div className="flex flex-col items-center gap-4">
              <h2 className="font-extrabold leading-none tracking-[-0.03em] text-ink text-[clamp(3rem,14vw,5rem)]">
                {word.word}
              </h2>
              <HandShapeDiagram handshape={handshape} size="lg" animate />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                American Sign Language
              </p>
            </div>
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
          {asReveal && phase === "prompt" && (
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

          {isListeningMode && !listenUnusable && phase === "prompt" && (
            <motion.div
              key="listen"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SOFT}
            >
              <p className="mb-3 text-center text-[12px] font-medium text-muted">
                Listen, then choose what you heard
              </p>
              <ChoiceOptions
                choices={choices}
                correctId={word.id}
                selectedId={selectedId}
                onSelect={choose}
              />
            </motion.div>
          )}

          {isSpeakingMode && phase === "prompt" && (
            <motion.div
              key="speak"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SOFT}
            >
              <SpeakButton
                bcp47={bcp47}
                partial={spokenPartial}
                listening={listening}
                hapticsEnabled={hapticsEnabled}
                onStart={beginListening}
                onPartial={setSpokenPartial}
                onFinal={() => {}}
                onUnavailable={() => setSpokenPartial("")}
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
              {canSpeak && (
                <div className="flex justify-center">
                  <PronunciationButton
                    text={word.word}
                    bcp47={bcp47}
                    hint={word.pronunciation}
                    hapticsEnabled={hapticsEnabled}
                  />
                </div>
              )}

{/* What the recogniser heard, and how close it landed. Shown on the answer
                  side because a learner who said the right word should see that
                  their pronunciation was accepted — otherwise the interaction
                  feels like it is grading them on something invisible. */}
              {isSpeakingMode && spokenQuality !== null && (
                <div
                  className="rounded-panel border border-line bg-paper/60 p-4 text-center"
                  role="status"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                    Heard
                  </p>
                  <p
                    lang={word.language}
                    className="mt-1.5 text-[15px] font-semibold text-ink-soft"
                  >
                    {heard}
                  </p>
                  <p className="mt-2 text-[12.5px] text-muted">
                    {spokenQuality === "exact" && "Close enough — that counts."}
                    {spokenQuality === "near" && "We read that as the word. Good."}
                    {spokenQuality === "miss" && "We couldn't match that to the word."}
                  </p>
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

              {/* Word Help. Only ever shown when the word is genuinely confusing
                  — a question the learner asked — and it appears above the
                  rating row, because the next action after being confused is to
                  understand, not to score yourself. */}
              {!firstExposure && help.help === null && (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() =>
                      help.ask(word, meaning, {
                        targetLanguage: language.code,
                        targetLanguageName: language.name,
                        nativeLanguage,
                        nativeLanguageName: getNativeLanguage(nativeLanguage)?.name ?? "English",
                      })
                    }
                    disabled={help.loading}
                    className="press chrome-noselect inline-flex items-center gap-1.5 rounded-chip px-3 py-2 text-[12.5px] font-semibold text-faint hover:text-ink disabled:opacity-50"
                  >
                    <HelpCircle className="size-3.5" strokeWidth={2.2} />
                    {help.loading ? "Thinking…" : help.failed ? "Try again" : "Stuck?"}
                  </button>
                </div>
              )}

              {help.help && (
                <div
                  className="rounded-panel border border-line bg-paper/60 p-4"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                    In short
                  </p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                    {help.help.explanation}
                  </p>
                  {help.help.usageNote && (
                    <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                      {help.help.usageNote}
                    </p>
                  )}
                  {help.help.extraExamples.map((ex, i) => (
                    <div key={i} className="mt-3 border-t border-line pt-3">
                      <p lang={word.language} className="text-[13.5px] font-semibold text-ink">
                        {ex.native}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted">{ex.translation}</p>
                    </div>
                  ))}
                </div>
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
