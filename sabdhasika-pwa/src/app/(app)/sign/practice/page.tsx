"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Hand,
  Lightbulb,
  RefreshCw,
  Trophy,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/nav/AppShell";
import { SignCamera } from "@/components/sign/SignCamera";
import { Button } from "@/components/ui/Button";
import { sfx } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { loadSignModel, type SignModel } from "@/lib/sign/model";
import { pickWords, type Difficulty, type PracticeWord } from "@/lib/sign/practice-words";
import { TRAINABLE_LETTERS } from "@/lib/sign/samples";
import { useSignRecognizer } from "@/lib/sign/useSignRecognizer";

// ─── constants ────────────────────────────────────────────────────────────────

/** ms a letter must be held before it counts as signed. */
const DWELL_MS = 1000;
/** ms to hold the correct letter before auto-advancing. */
const SUCCESS_HOLD_MS = 600;
/** How many words make one practice round. */
const ROUND_SIZE = 5;

// ─── types ─────────────────────────────────────────────────────────────────────

type Phase = "pick" | "read" | "practice" | "result";
type LetterState = "pending" | "active" | "correct" | "wrong";

interface RoundResult {
  word: string;
  attemptsPerLetter: number[];
  passed: boolean;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function letterStates(word: string, currentIdx: number, results: boolean[]): LetterState[] {
  return word.split("").map((_, i) => {
    if (i < currentIdx) return results[i] ? "correct" : "wrong";
    if (i === currentIdx) return "active";
    return "pending";
  });
}

function accuracy(results: RoundResult[]): number {
  if (results.length === 0) return 0;
  const totalLetters = results.reduce((s, r) => s + r.word.length, 0);
  const totalCorrect = results.reduce(
    (s, r) => s + r.attemptsPerLetter.filter((a) => a === 1).length,
    0,
  );
  return Math.round((totalCorrect / totalLetters) * 100);
}

// ─── component ────────────────────────────────────────────────────────────────

export default function SignPracticePage() {
  const [model, setModel] = useState<SignModel | null>(null);
  const [modelState, setModelState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let alive = true;
    loadSignModel()
      .then((m) => {
        if (!alive) return;
        setModel(m);
        setModelState("ready");
      })
      .catch(() => {
        if (alive) setModelState("missing");
      });
    return () => {
      alive = false;
    };
  }, []);

  const recognition = useSignRecognizer({ model });
  const { letter, status, hasHand } = recognition;

  // ── session state ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("pick");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [words, setWords] = useState<PracticeWord[]>([]);
  const [wordIdx, setWordIdx] = useState(0);
  const [letterIdx, setLetterIdx] = useState(0);
  const [attempts, setAttempts] = useState<number[]>([]); // per-letter attempt count
  const [letterResults, setLetterResults] = useState<boolean[]>([]); // per-letter first-try pass
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);

  const currentWord = words[wordIdx] ?? null;
  const targetLetter = currentWord?.word[letterIdx] ?? null;
  const states = currentWord ? letterStates(currentWord.word, letterIdx, letterResults) : [];

  // ── dwell-to-commit (correct letter) ──────────────────────────────────────
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = useRef<string | null>(null);
  /** Tracks the last letter for which we already fired a wrong penalty this dwell cycle. */
  const wrongPenalisedRef = useRef<string | null>(null);

  /** Clear all pending timers (safe to call from cleanup). */
  const clearTimers = useCallback(() => {
    if (successTimer.current) { clearTimeout(successTimer.current); successTimer.current = null; }
    if (wrongTimer.current) { clearTimeout(wrongTimer.current); wrongTimer.current = null; }
    if (dwellTimer.current) { clearTimeout(dwellTimer.current); dwellTimer.current = null; }
  }, []);

  // Advance to the next letter after success hold.
  const advanceLetter = useCallback((letterResults_: boolean[], attempts_: number[]) => {
    if (!currentWord) return;
    const nextIdx = letterIdx + 1;
    if (nextIdx >= currentWord.word.length) {
      // Word complete.
      const result: RoundResult = {
        word: currentWord.word,
        attemptsPerLetter: attempts_,
        passed: letterResults_.every(Boolean),
      };
      setRoundResults((prev) => [...prev, result]);
      sfx.complete();
      const nextWordIdx = wordIdx + 1;
      if (nextWordIdx >= words.length) {
        setPhase("result");
      } else {
        setWordIdx(nextWordIdx);
        setLetterIdx(0);
        setLetterResults([]);
        setAttempts([]);
        setShowHint(false);
        committedRef.current = null;
      }
    } else {
      setLetterIdx(nextIdx);
      committedRef.current = null;
    }
  }, [currentWord, letterIdx, wordIdx, words.length]);

  // Track recognised letter against target.
  // NOTE: `attempts` is intentionally NOT in the dep array — we read it via
  // a snapshot inside the timeout and update it with a functional setState,
  // which avoids a feedback loop where updating attempts re-triggers the timer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== "practice" || !targetLetter) return;

    clearTimers();

    if (!letter) {
      committedRef.current = null;
      wrongPenalisedRef.current = null;
      return;
    }

    if (letter === targetLetter) {
      wrongPenalisedRef.current = null;
      // Correct — start dwell timer.
      if (committedRef.current === letter) return; // already committed
      dwellTimer.current = setTimeout(() => {
        committedRef.current = letter;
        sfx.correct();
        // Mark correct on first try if no wrong attempts were logged yet.
        setAttempts((prev) => {
          const wasFirstTry = (prev[letterIdx] ?? 0) === 0;
          setLetterResults((prevResults) => {
            const newResults = [...prevResults, wasFirstTry];
            const newAttempts = [...prev];
            if (newAttempts[letterIdx] === undefined) newAttempts[letterIdx] = 1;
            // Advance in next tick so state has settled.
            successTimer.current = setTimeout(() => {
              advanceLetter(newResults, newAttempts);
            }, SUCCESS_HOLD_MS);
            return newResults;
          });
          const next = [...prev];
          if (next[letterIdx] === undefined) next[letterIdx] = 1;
          return next;
        });
      }, DWELL_MS);
    } else {
      // Wrong letter held long enough → flash red once per distinct wrong letter.
      if (wrongPenalisedRef.current === letter) return;
      wrongTimer.current = setTimeout(() => {
        wrongPenalisedRef.current = letter;
        setWrongFlash(true);
        setAttempts((prev) => {
          const next = [...prev];
          next[letterIdx] = (next[letterIdx] ?? 0) + 1;
          return next;
        });
        setTimeout(() => setWrongFlash(false), 500);
      }, DWELL_MS);
    }

    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter, targetLetter, phase, letterIdx, letterResults, advanceLetter, clearTimers]);

  // ── start a round ──────────────────────────────────────────────────────────
  const startRound = useCallback((diff: Difficulty) => {
    const picked = pickWords(diff, ROUND_SIZE);
    setWords(picked);
    setWordIdx(0);
    setLetterIdx(0);
    setLetterResults([]);
    setAttempts([]);
    setRoundResults([]);
    setShowHint(false);
    setDifficulty(diff);
    committedRef.current = null;
    setPhase("read");
  }, []);

  const beginSigning = useCallback(() => {
    setPhase("practice");
  }, []);

  const restart = useCallback(() => {
    clearTimers();
    setPhase("pick");
    setWords([]);
    setWordIdx(0);
    setLetterIdx(0);
    setLetterResults([]);
    setAttempts([]);
    setRoundResults([]);
    setShowHint(false);
    committedRef.current = null;
  }, [clearTimers]);

  const retryDifficulty = useCallback(() => {
    clearTimers();
    startRound(difficulty);
  }, [clearTimers, difficulty, startRound]);

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader
        eyebrow="American Sign Language"
        title="Practice"
        trailing={
          <span className="flex items-center gap-4">
            <Link
              href="/sign"
              className="press inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2.4} />
              Fingerspelling
            </Link>
            <Link href="/sign/record" className="press text-[12.5px] font-semibold text-muted hover:text-ink">
              Add samples
            </Link>
          </span>
        }
      />

      {modelState === "missing" && (
        <div className="mb-3 rounded-panel border border-line bg-surface pad-panel">
          <p className="text-[13.5px] font-semibold text-ink">No recogniser trained yet</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            Record a few samples of each letter, export them, then run{" "}
            <code className="rounded bg-paper px-1.5 py-0.5 text-[12px]">npm run sign:train</code>. Practice becomes
            available as soon as a model is present.
          </p>
          <div className="mt-4">
            <Link href="/sign/record">
              <Button size="sm">Record samples</Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Phase: pick difficulty ───────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase === "pick" && (
          <PickPhase key="pick" onStart={startRound} />
        )}

        {/* ── Phase: read the word ───────────────────────────────────────── */}
        {phase === "read" && currentWord && (
          <ReadPhase
            key={`read-${wordIdx}`}
            word={currentWord}
            wordIdx={wordIdx}
            total={words.length}
            onReady={beginSigning}
          />
        )}

        {/* ── Phase: practice ───────────────────────────────────────────── */}
        {phase === "practice" && currentWord && (
          <motion.div
            key={`practice-${wordIdx}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-3"
          >
            {/* Camera */}
            <div>
              <SignCamera
                status={status}
                error={recognition.error}
                videoRef={recognition.videoRef}
                canvasRef={recognition.canvasRef}
                hasHand={hasHand}
                onStart={recognition.start}
                onRetry={recognition.retry}
                overlay={
                  <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-col items-center px-4">
                    <div
                      className={cn(
                        "min-w-[92px] rounded-panel px-6 py-2 text-center backdrop-blur transition-colors duration-200",
                        wrongFlash
                          ? "bg-bad/60"
                          : letter === targetLetter
                            ? "bg-good/60"
                            : "bg-black/45",
                      )}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                        Detected
                      </div>
                      <div className="text-[52px] font-extrabold leading-none tracking-[-0.03em] text-white">
                        {letter ?? "–"}
                      </div>
                    </div>
                  </div>
                }
              />
              <p className="mt-3 flex items-center gap-2 px-1 text-[11px] text-faint">
                <span className="size-1.5 rounded-full bg-good" />
                Processed on your device. No video leaves it.
              </p>
            </div>

            {/* Controls */}
            <div className="mt-3 flex flex-col gap-3 lg:mt-0">
              {/* Word + letter tracker */}
              <section className="rounded-panel border border-line bg-paper pad-panel">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                    Word {wordIdx + 1} of {words.length}
                  </p>
                  <span className="text-[11px] text-faint">{difficulty}</span>
                </div>

                {/* Letter tiles */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {currentWord.word.split("").map((ch, i) => {
                    const s = states[i];
                    return (
                      <motion.div
                        key={i}
                        animate={
                          s === "active"
                            ? { scale: [1, 1.08, 1], transition: { repeat: Infinity, duration: 1.4 } }
                            : { scale: 1 }
                        }
                        className={cn(
                          "relative grid size-14 place-items-center rounded-xl border-2 text-[26px] font-extrabold tracking-[-0.02em] transition-colors duration-200",
                          s === "pending" && "border-line bg-surface text-faint",
                          s === "active" && "border-ink bg-ink text-paper shadow-lg",
                          s === "correct" && "border-good bg-good-soft text-good",
                          s === "wrong" && "border-bad/50 bg-bad/10 text-bad",
                        )}
                      >
                        {ch}
                        {s === "correct" && (
                          <CheckCircle2
                            className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-paper text-good"
                            strokeWidth={2.5}
                          />
                        )}
                        {s === "wrong" && (
                          <XCircle
                            className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-paper text-bad"
                            strokeWidth={2.5}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Instruction */}
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  Hold the sign for{" "}
                  <span className="font-semibold text-ink">&ldquo;{targetLetter}&rdquo;</span> until it
                  locks in, then move to the next letter.
                </p>

                {/* Hint */}
                {showHint ? (
                  <div className="mt-3 flex items-start gap-2 rounded-chip border border-line bg-surface px-3 py-2">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-faint" strokeWidth={2} />
                    <p className="text-[12.5px] leading-relaxed text-muted">{currentWord.hint}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowHint(true)}
                    className="press mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-faint hover:text-ink"
                  >
                    <Lightbulb className="size-3.5" strokeWidth={2} />
                    Show hint
                  </button>
                )}
              </section>

              {/* Alphabet reference — highlights the target letter */}
              <section className="rounded-panel border border-line bg-paper pad-panel">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                  Manual alphabet
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {TRAINABLE_LETTERS.map((ch) => (
                    <span
                      key={ch}
                      className={cn(
                        "grid size-7 place-items-center rounded-md border text-[12.5px] font-semibold tabular-nums",
                        ch === targetLetter
                          ? "border-transparent bg-ink text-paper"
                          : "border-line bg-surface text-ink/60",
                      )}
                    >
                      {ch}
                    </span>
                  ))}
                  {["J", "Z"].map((ch) => (
                    <span
                      key={ch}
                      title="Motion sign — not recognisable as a still pose."
                      className="grid size-7 place-items-center rounded-md border border-dashed border-line text-[12.5px] font-semibold text-faint"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </section>

              {/* Quit */}
              <button
                type="button"
                onClick={restart}
                className="press self-start text-[12px] font-semibold text-faint hover:text-ink"
              >
                Quit round
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Phase: results ────────────────────────────────────────────── */}
        {phase === "result" && (
          <ResultPhase
            key="result"
            results={roundResults}
            difficulty={difficulty}
            onRetry={retryDifficulty}
            onRestart={restart}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PickPhase({ onStart }: { onStart: (d: Difficulty) => void }) {
  const tiers: Array<{ difficulty: Difficulty; label: string; description: string; letters: string }> = [
    {
      difficulty: "easy",
      label: "Easy",
      description: "3-letter words",
      letters: "cat · dog · sun",
    },
    {
      difficulty: "medium",
      label: "Medium",
      description: "4-letter words",
      letters: "fish · moon · rain",
    },
    {
      difficulty: "hard",
      label: "Hard",
      description: "5–6 letter words",
      letters: "brush · storm · spine",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-xl"
    >
      <div className="mb-6 rounded-panel border border-line bg-paper pad-panel">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-soft">
            <Hand className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink">How it works</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              You&rsquo;ll be shown a word to read and memorise, then fingerspell it letter by letter
              in front of your camera. Hold each handshape steady — the app confirms each letter as
              you sign it. Five words per round.
            </p>
          </div>
        </div>
      </div>

      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
        Choose difficulty
      </p>
      <div className="flex flex-col gap-2">
        {tiers.map((t) => (
          <button
            key={t.difficulty}
            type="button"
            onClick={() => onStart(t.difficulty)}
            className="press lift flex items-center gap-4 rounded-panel border border-line bg-paper pad-panel text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{t.label}</span>
              <span className="mt-0.5 block text-[12.5px] text-muted">{t.description}</span>
              <span className="mt-1 block font-mono text-[11px] tracking-wide text-faint">{t.letters}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={2.2} />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ReadPhase({
  word,
  wordIdx,
  total,
  onReady,
}: {
  word: PracticeWord;
  wordIdx: number;
  total: number;
  onReady: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center py-12 text-center"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
        Word {wordIdx + 1} of {total} — read and remember
      </p>

      {/* The big word */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {word.word.split("").map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid size-16 place-items-center rounded-xl border-2 border-line bg-paper text-[30px] font-extrabold text-ink shadow-sm"
          >
            {ch}
          </motion.span>
        ))}
      </div>

      {/* Hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: word.word.length * 0.06 + 0.2 }}
        className="mt-6 max-w-xs text-[13.5px] leading-relaxed text-muted"
      >
        {word.hint}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: word.word.length * 0.06 + 0.4 }}
        className="mt-8"
      >
        <Button size="lg" onClick={onReady}>
          I&rsquo;m ready — start signing
          <ArrowRight className="size-4" strokeWidth={2.4} />
        </Button>
      </motion.div>
    </motion.div>
  );
}

function ResultPhase({
  results,
  difficulty,
  onRetry,
  onRestart,
}: {
  results: RoundResult[];
  difficulty: Difficulty;
  onRetry: () => void;
  onRestart: () => void;
}) {
  const acc = accuracy(results);
  const passed = results.filter((r) => r.passed).length;

  const emoji = acc >= 90 ? "🏆" : acc >= 70 ? "⭐" : acc >= 50 ? "👍" : "💪";
  const headline =
    acc >= 90 ? "Excellent!" : acc >= 70 ? "Great work!" : acc >= 50 ? "Nice effort!" : "Keep practising!";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-xl"
    >
      {/* Score card */}
      <section className="surface-card grain relative isolate overflow-hidden rounded-panel pad-card">
        <div className="flex items-center gap-4">
          <span className="text-[40px] leading-none">{emoji}</span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Round complete</p>
            <p className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-ink">
              {headline}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Accuracy", value: `${acc}%` },
            { label: "Words passed", value: `${passed}/${results.length}` },
            { label: "Difficulty", value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1) },
          ].map((s) => (
            <div key={s.label} className="rounded-chip border border-line bg-paper/60 p-3">
              <p className="text-[18px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                {s.value}
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Per-word breakdown */}
      <section className="mt-3 rounded-panel border border-line bg-paper pad-panel">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Word breakdown</p>
        <div className="mt-3 flex flex-col gap-2">
          {results.map((r, i) => {
            const firstTries = r.attemptsPerLetter.filter((a) => a === 1).length;
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-chip border border-line bg-surface px-3 py-2.5"
              >
                {r.passed ? (
                  <Trophy className="size-4 shrink-0 text-good" strokeWidth={2} />
                ) : (
                  <RefreshCw className="size-4 shrink-0 text-muted" strokeWidth={2} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-[14px] font-semibold text-ink">{r.word}</span>
                </span>
                <span className="shrink-0 text-[12px] text-muted tabular-nums">
                  {firstTries}/{r.word.length} first-try
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button size="lg" onClick={onRetry}>
          <RefreshCw className="size-4" strokeWidth={2.4} />
          Try again
        </Button>
        <Button size="lg" variant="secondary" onClick={onRestart}>
          Change difficulty
        </Button>
        <Link href="/sign" className="self-center">
          <button
            type="button"
            className="press text-[12.5px] font-semibold text-muted hover:text-ink"
          >
            Back to Fingerspelling
          </button>
        </Link>
      </div>
    </motion.div>
  );
}
