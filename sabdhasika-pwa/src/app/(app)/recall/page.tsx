"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Eye, RotateCcw, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StreakChip } from "@/components/celebrate/Flame";
import { EmptyState } from "@/components/EmptyState";
import { PronunciationButton, requestSpeak } from "@/components/learn/PronunciationButton";
import { PageHeader } from "@/components/nav/AppShell";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { sfx } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { resolveMeaning } from "@/lib/data";
import {
  RECALL_DECK_SIZE,
  blankOut,
  buildRecallDeck,
  recallStrength,
  type RecallCard,
} from "@/lib/engine/recall";
import { haptics } from "@/lib/haptics";
import { useHasKeyboard } from "@/lib/hooks";
import { getLanguage } from "@/lib/languages";
import { track } from "@/lib/metrics";
import { heroFontSize, isRtl } from "@/lib/romanization";
import { useStore } from "@/lib/store";

const SPRING = { type: "spring" as const, stiffness: 300, damping: 32, mass: 0.85 };
const SOFT = { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const };

type Phase = "intro" | "drill" | "done";

/**
 * Recall — the other direction.
 *
 * A session shows the word and asks what it means: *recognition*. That is the
 * easy direction, and on its own it produces learners who can read a page but
 * cannot order a coffee. This screen inverts the card: you are given the
 * meaning and must produce the word before it appears.
 *
 * Three rules keep it honest:
 *  · **You must commit before you see.** The word stays hidden until you ask
 *    for it, so the reveal is a check rather than a prompt.
 *  · **The judgement is yours, but it costs something.** "Not quite" sends the
 *    word back through the scheduler as a lapse, so the drill actually changes
 *    what you see tomorrow instead of being a side game with its own score.
 *  · **It is a bonus, not a chore.** The streak still belongs to the daily
 *    session; this screen can never keep a streak alive on its own.
 */
export default function RecallPage() {
  const hasKeyboard = useHasKeyboard();

  const state = useStore((s) => s.state);
  const recordRecall = useStore((s) => s.recordRecall);
  const undoRecall = useStore((s) => s.undoRecall);

  const { settings, streak } = state;
  const language = getLanguage(settings.targetLanguage);

  const [phase, setPhase] = useState<Phase>("intro");
  const [cards, setCards] = useState<RecallCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);

  const strength = useMemo(() => recallStrength(state), [state]);
  const available = useMemo(() => buildRecallDeck(state).cards.length, [state]);

  const current = cards[index] ?? null;
  const total = cards.length;

  /* ---------------------------------------------------------------- *
   * Actions
   * ---------------------------------------------------------------- */

  const start = useCallback(() => {
    const deck = buildRecallDeck(state);
    if (deck.cards.length === 0) return;
    setCards(deck.cards);
    setIndex(0);
    setRevealed(false);
    setResults([]);
    setPhase("drill");
    track("recall_start", { size: deck.cards.length });
  }, [state]);

  const reveal = useCallback(() => {
    if (revealed) return;
    setRevealed(true);
    haptics.reveal(settings.hapticsEnabled);
    sfx.reveal();
  }, [revealed, settings.hapticsEnabled]);

  const answer = useCallback(
    (remembered: boolean) => {
      if (!current || !revealed) return;
      haptics[remembered ? "correct" : "incorrect"](settings.hapticsEnabled);
      sfx[remembered ? "correct" : "incorrect"]();
      recordRecall(current.word.id, remembered);

      const next = [...results, remembered];
      setResults(next);

      if (index + 1 >= total) {
        setPhase("done");
        track("recall_complete", {
          remembered: next.filter(Boolean).length,
          size: total,
        });
      } else {
        setIndex(index + 1);
        setRevealed(false);
      }
    },
    [current, index, recordRecall, results, revealed, settings.hapticsEnabled, total],
  );

  /** Step back one card, restoring both the UI and the scheduler. */
  const undo = useCallback(() => {
    if (results.length === 0) return;
    undoRecall();
    const next = results.slice(0, -1);
    setResults(next);
    setIndex(next.length);
    setRevealed(false);
    setPhase("drill");
  }, [results, undoRecall]);

  /* ---------------------------------------------------------------- *
   * Reveal speaks the word: after a failed production attempt, hearing it
   * is exactly the feedback that makes it stick.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (phase !== "drill" || !revealed || !current) return;
    if (!settings.pronunciationEnabled) return;
    const t = setTimeout(() => requestSpeak(current.word.word), 280);
    return () => clearTimeout(t);
  }, [current, phase, revealed, settings.pronunciationEnabled]);

  /* ---------------------------------------------------------------- *
   * Keyboard: Space reveals, 1 = not quite, 2 = had it, ⌘Z steps back.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (phase !== "drill") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
        return;
      }

      if (!revealed) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          reveal();
        }
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        answer(false);
      } else if (e.key === "2" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        answer(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, phase, reveal, revealed, undo]);

  /* ================================================================ *
   * Intro
   * ================================================================ */

  if (phase === "intro") {
    return (
      <div className="pt-5 lg:pt-0">
        <PageHeader
          eyebrow={`${language.name} · from memory`}
          title="Recall"
          trailing={<StreakChip days={streak.current} />}
        />

        {available === 0 ? (
          <EmptyState
            glyph="?"
            reading="recall"
            title="Nothing to recall yet"
            body="Recall works on words you have already met. Finish today's session and a drill will be waiting here."
            action={
              <Link href="/learn">
                <Button size="lg">
                  Today&apos;s words
                  <ArrowRight className="size-4" strokeWidth={2.4} />
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
              className="surface-card grain relative isolate overflow-hidden pad-card lg:pad-card-lg"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                The harder direction
              </p>
              <h2 className="mt-3 text-[clamp(1.5rem,6vw,1.9rem)] font-extrabold leading-[1.12] tracking-[-0.035em] text-ink">
                You know it when you see it.
                <br />
                <span className="text-muted">Can you find it when you don&apos;t?</span>
              </h2>
              <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-muted">
                A session gives you the {language.name} word and asks what it means. This does the
                opposite: you get the meaning, and you have to produce the word. It is harder, and
                it is the difference between recognising a word and being able to use one.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <Stat label="Ready now" value={String(available)} />
                <Stat
                  label="Recall rate"
                  value={strength.rate === null ? "—" : `${Math.round(strength.rate * 100)}%`}
                />
                <Stat label="Attempts" value={String(strength.total)} />
              </div>

              <Button size="lg" full className="mt-6 h-14" onClick={start}>
                Recall {Math.min(available, RECALL_DECK_SIZE)} words
                <ArrowRight className="size-4" strokeWidth={2.4} />
              </Button>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="mt-3 rounded-panel border border-line bg-paper pad-panel"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                How it works
              </p>
              <ol className="mt-4 flex flex-col gap-4">
                {[
                  { n: "1", text: "Read the meaning. No word, no hints." },
                  { n: "2", text: "Say it out loud, or write it in your head. Actually try." },
                  { n: "3", text: "Reveal it, then be honest. Missed words come back sooner." },
                ].map((step) => (
                  <li key={step.n} className="flex items-start gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-paper tabular-nums">
                      {step.n}
                    </span>
                    <span className="text-[13.5px] leading-relaxed text-ink-soft">{step.text}</span>
                  </li>
                ))}
              </ol>
            </motion.section>
          </>
        )}
      </div>
    );
  }

  /* ================================================================ *
   * Summary
   * ================================================================ */

  if (phase === "done" || !current) {
    const remembered = results.filter(Boolean).length;
    const missed = cards.filter((_, i) => results[i] === false);

    return (
      <div className="flex min-h-[70svh] flex-col justify-center pt-5 lg:pt-0">
        <div className="mx-auto w-full max-w-md pb-4">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="mx-auto grid size-20 place-items-center rounded-card bg-ink"
          >
            <Check className="size-8 text-paper" strokeWidth={2.8} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-center text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-ink"
          >
            {remembered === total && total > 0
              ? "Every one, from memory"
              : `${remembered} of ${total} from memory`}
          </motion.h1>
          <p className="mt-2 text-center text-[13.5px] leading-relaxed text-muted">
            {missed.length === 0
              ? "That is production, not recognition. Keep it up."
              : `${missed.length} ${missed.length === 1 ? "word is" : "words are"} now scheduled to come back sooner.`}
          </p>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <Stat label="Recalled" value={String(remembered)} tone="good" />
            <Stat label="To look again" value={String(missed.length)} tone={missed.length ? "accent" : "plain"} />
          </div>

          {missed.length > 0 && (
            <div className="mt-3 rounded-panel border border-line bg-paper pad-panel">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                Worth another look
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {missed.map((c) => (
                  <li key={c.word.id} className="flex items-baseline justify-between gap-4">
                    <span
                      lang={c.word.language}
                      dir={isRtl(c.word.language) ? "rtl" : "ltr"}
                      className="text-[16px] font-bold text-ink"
                    >
                      {c.word.word}
                    </span>
                    <span className="min-w-0 truncate text-[12.5px] text-muted">
                      {resolveMeaning(c.word, settings.nativeLanguage)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" full onClick={start} disabled={available === 0}>
              <RotateCcw className="size-4" strokeWidth={2.4} />
              {available === 0 ? "No words left to drill" : `Another ${Math.min(available, RECALL_DECK_SIZE)} words`}
            </Button>
            <Link href="/learn" className="block">
              <Button size="lg" variant="secondary" full>
                Done
              </Button>
            </Link>
          </div>

          <p className="mt-6 text-center text-[12px] text-faint">
            Every attempt fed straight back into your review schedule.
          </p>
        </div>
      </div>
    );
  }

  /* ================================================================ *
   * Drill
   * ================================================================ */

  const word = current.word;
  const meaning = resolveMeaning(word, settings.nativeLanguage);
  const blanked = word.example ? blankOut(word.example.native, word.word) : null;

  return (
    <div className="pt-5 lg:pt-0">
      {/* ── drill bar ───────────────────────────────────────────────── */}
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPhase("intro")}
          aria-label="Leave the drill"
          className="press grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
        >
          <X className="size-5" strokeWidth={2.2} />
        </button>

        <ProgressBar
          value={results.length}
          max={total}
          height={6}
          className="flex-1"
          label="Drill progress"
        />
        <span className="shrink-0 text-[12.5px] font-semibold text-muted tabular-nums">
          {index + 1}
          <span className="text-faint"> / {total}</span>
        </span>

        <button
          type="button"
          onClick={undo}
          disabled={results.length === 0}
          aria-label="Undo last answer"
          title="Undo last answer (Ctrl+Z)"
          className={cn(
            "press grid size-9 shrink-0 place-items-center rounded-full text-muted",
            "hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30",
          )}
        >
          <Undo2 className="size-4" strokeWidth={2.2} />
        </button>
      </header>

      {/* ── the card ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={word.id}
          initial={{ opacity: 0, x: 26, scale: 0.985 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -22, scale: 0.99 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          aria-label={`Recall card: ${meaning}`}
          className={cn(
            "surface-card grain relative isolate flex w-full flex-col overflow-hidden",
            "min-h-[min(66svh,540px)]",
            !revealed && "cursor-pointer",
          )}
          onClick={!revealed ? reveal : undefined}
        >
          <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4">
            <span className="rounded-full border border-line bg-paper/70 px-3 py-1 text-[11px] font-semibold text-muted tabular-nums">
              No. {word.frequencyRank}
            </span>
            <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-ink-soft">
              {current.reason}
            </span>
          </header>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-4 text-center">
            {!revealed ? (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                  Say it in {language.name}
                </span>
                <motion.h2
                  layout="position"
                  transition={{ layout: SPRING }}
                  className="mt-3 font-extrabold leading-[1.08] tracking-[-0.03em] text-ink"
                  style={{ fontSize: "clamp(1.6rem, 6vw, 2.6rem)" }}
                >
                  {meaning}
                </motion.h2>
                {word.partOfSpeech && (
                  <p className="mt-3 text-[12.5px] font-medium text-muted">{word.partOfSpeech}</p>
                )}

                {blanked && word.example && (
                  <div className="mt-6 w-full rounded-panel border border-line bg-paper/60 p-4">
                    <span className="hairline mx-auto mb-3 block w-12" />
                    <p
                      lang={word.language}
                      dir={isRtl(word.language) ? "rtl" : "ltr"}
                      className="text-center text-[15px] font-semibold leading-snug text-ink"
                    >
                      {blanked}
                    </p>
                    <p className="mt-2 text-center text-[13px] leading-snug text-ink-soft">
                      {word.example.translation}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <motion.h2
                  initial={{ opacity: 0, scale: 0.86 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={SPRING}
                  dir={isRtl(word.language) ? "rtl" : "ltr"}
                  lang={word.language}
                  className="font-extrabold leading-[1.02] tracking-[-0.035em] text-ink"
                  style={{ fontSize: heroFontSize(word.word) }}
                >
                  {word.word}
                </motion.h2>
                {word.reading && word.reading !== word.word && (
                  <p lang={word.language} className="mt-3 text-[clamp(0.95rem,3.4vw,1.3rem)] font-medium text-muted">
                    {word.reading}
                  </p>
                )}
                {word.romanized && (
                  <p className="mt-1 font-serif text-[clamp(0.95rem,3.2vw,1.25rem)] italic text-faint">
                    {word.romanized}
                  </p>
                )}

                {settings.pronunciationEnabled && (
                  <div className="mt-4">
                    <PronunciationButton
                      text={word.word}
                      bcp47={language.bcp47}
                      hint={word.pronunciation}
                      hapticsEnabled={settings.hapticsEnabled}
                    />
                  </div>
                )}

                {word.example && (
                  <div className="mt-4 w-full rounded-panel border border-line bg-paper/60 p-4">
                    <p
                      lang={word.language}
                      dir={isRtl(word.language) ? "rtl" : "ltr"}
                      className="text-center text-[15px] font-semibold leading-snug text-ink"
                    >
                      {word.example.native}
                    </p>
                    <p className="mt-2 text-center text-[13px] leading-snug text-ink-soft">
                      {word.example.translation}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="relative z-10 px-5 pb-5">
            <AnimatePresence mode="wait" initial={false}>
              {!revealed ? (
                <motion.div
                  key="prompt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={SOFT}
                  className="flex flex-col items-center gap-3"
                >
                  <span className="hairline w-24" />
                  <button
                    type="button"
                    onClick={reveal}
                    className="press chrome-noselect inline-flex h-14 w-full items-center justify-center gap-2 rounded-row bg-ink text-[15px] font-semibold text-paper"
                  >
                    <Eye className="size-4" strokeWidth={2.4} />
                    Show the word
                    {hasKeyboard && (
                      <Kbd className="ml-1 border-transparent bg-paper/15 text-paper/70">Space</Kbd>
                    )}
                  </button>
                  <span className="text-[12px] text-faint">
                    Say it out loud first — that is the whole exercise.
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="judge"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SOFT, delay: 0.06 }}
                  className="flex flex-col gap-3"
                >
                  <p className="text-center text-[12px] font-medium text-muted">
                    Did you have it before you looked?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => answer(false)}
                      className="press chrome-noselect inline-flex h-14 items-center justify-center gap-2 rounded-row border border-line bg-surface text-[15px] font-semibold text-ink hover:bg-surface-2"
                    >
                      Not quite
                      {hasKeyboard && <Kbd className="ml-1">1</Kbd>}
                    </button>
                    <button
                      type="button"
                      onClick={() => answer(true)}
                      className="press chrome-noselect inline-flex h-14 items-center justify-center gap-2 rounded-row bg-ink text-[15px] font-semibold text-paper"
                    >
                      I had it
                      {hasKeyboard && (
                        <Kbd className="ml-1 border-transparent bg-paper/15 text-paper/70">2</Kbd>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * A tile for the intro and summary numbers.
 * ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "good" | "accent";
}) {
  return (
    <div className="rounded-panel border border-line bg-paper p-4">
      <p
        className={cn(
          "text-[22px] font-extrabold leading-none tracking-[-0.03em] tabular-nums",
          tone === "good" ? "text-good" : tone === "accent" ? "text-accent" : "text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-[11.5px] font-medium text-muted">{label}</p>
    </div>
  );
}
