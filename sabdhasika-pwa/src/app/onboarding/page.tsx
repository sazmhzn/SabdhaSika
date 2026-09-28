"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlyphTile } from "@/components/ui/GlyphTile";
import { sfx } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { getVocabulary, resolveMeaning } from "@/lib/data";
import { haptics } from "@/lib/haptics";
import { LANGUAGES, NATIVE_LANGUAGES, getLanguage } from "@/lib/languages";
import { track } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { LanguageCode, NativeLanguageCode } from "@/lib/types";

type Goal = 10 | 20 | 25 | 30;

const STEP_TITLES = ["Welcome", "Target language", "Native language", "Daily goal", "Ready"];

/** ~12s per word including the reveal and the rating. */
const SECONDS_PER_WORD = 12;
/** Roughly 60% of a session is new words, so this is days-to-500. */
const NEW_WORD_SHARE = 0.6;

export default function OnboardingPage() {
  const router = useRouter();
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const hapticsEnabled = useStore((s) => s.state.settings.hapticsEnabled);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [target, setTarget] = useState<LanguageCode>("ja");
  const [native, setNative] = useState<NativeLanguageCode>("en");
  const [goal, setGoal] = useState<Goal>(25);
  const [query, setQuery] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const go = useCallback(
    (next: number) => {
      setDirection(next > step ? 1 : -1);
      setStep(next);
      haptics.tick(hapticsEnabled);
      track("onboarding_step", { step: next });
    },
    [hapticsEnabled, step],
  );

  const finish = useCallback(() => {
    haptics.celebrate(hapticsEnabled);
    sfx.complete();
    completeOnboarding({
      targetLanguage: target,
      nativeLanguage: native,
      dailyGoal: goal,
    });
    track("onboarding_complete", { target, native, goal });
    router.replace("/learn");
  }, [completeOnboarding, goal, hapticsEnabled, native, router, target]);

  /* ── keyboard ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName.toLowerCase();
      if (tag === "input") return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (step === 4) finish();
        else go(step + 1);
      }
      if ((e.key === "Backspace" || e.key === "ArrowLeft") && step > 0) {
        e.preventDefault();
        go(step - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, go, step]);

  /* ── announce step changes to screen readers ──────────────────────── */
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const language = getLanguage(target);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [query]);

  const goalMinutes = Math.round((goal * SECONDS_PER_WORD) / 60);
  const daysTo500 = Math.round(500 / (goal * NEW_WORD_SHARE));
  const previewWords = useMemo(() => getVocabulary(target).slice(0, 3), [target]);

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 34 : -34 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -24 : 24 }),
  };

  return (
    <div className="relative mx-auto flex min-h-svh w-full max-w-xl flex-col px-6 pt-safe">
      {/* ── chrome ─────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 pt-5">
        <div className="flex flex-1 gap-2" aria-hidden="true">
          {STEP_TITLES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i <= step ? "bg-ink" : "bg-surface-2",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={finish}
          className="press -mr-2 rounded-chip px-3 py-2 text-[13px] font-semibold text-muted hover:text-ink"
        >
          Skip
        </button>
      </header>

      {/* ── body ───────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col justify-center py-8">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {step === 0 && <StepPromise headingRef={headingRef} />}

            {step === 1 && (
              <StepTarget
                headingRef={headingRef}
                target={target}
                onTarget={setTarget}
                query={query}
                onQuery={setQuery}
                filtered={filtered}
              />
            )}

            {step === 2 && (
              <StepNative
                headingRef={headingRef}
                target={target}
                native={native}
                onNative={setNative}
              />
            )}

            {step === 3 && (
              <StepGoal
                headingRef={headingRef}
                goal={goal}
                onGoal={setGoal}
                minutes={goalMinutes}
                daysTo500={daysTo500}
              />
            )}

            {step === 4 && (
              <StepReady
                headingRef={headingRef}
                language={language}
                native={native}
                goal={goal}
                previewWords={previewWords}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── actions ────────────────────────────────────────────────── */}
      <footer className="flex items-center gap-3 pb-8">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className="press chrome-noselect inline-flex h-14 items-center gap-2 rounded-row border border-line bg-surface px-6 text-[15px] font-semibold text-ink"
          >
            <ArrowLeft className="size-4" strokeWidth={2.4} />
            Previous
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => (step === 4 ? finish() : go(step + 1))}
          className={cn(
            "press chrome-noselect inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-row",
            "bg-ink text-[15px] font-semibold text-paper",
          )}
        >
          {step === 0 && "Get Started"}
          {step === 1 && "Continue"}
          {step === 2 && "Continue"}
          {step === 3 && "Continue"}
          {step === 4 && (
            <>
              Start Learning
              <Sparkles className="size-4" strokeWidth={2.4} />
            </>
          )}
          {step > 0 && step < 4 && <ArrowRight className="size-4" strokeWidth={2.4} />}
        </button>
      </footer>
    </div>
  );
}

/* ================================================================== *
 * Step 1 — the promise
 * ================================================================== */

function StepPromise({ headingRef }: { headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const tiles = [
    { glyph: "あ", reading: "a", delay: 0 },
    { glyph: "श", reading: "śa", delay: 0.5 },
    { glyph: "ñ", reading: "eñe", delay: 1 },
  ];

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-9 flex items-end gap-3">
        {tiles.map((t, i) => (
          <motion.div
            key={t.glyph}
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: t.delay }}
          >
            <GlyphTile
              glyph={t.glyph}
              reading={t.reading}
              size={i === 1 ? 108 : 84}
              className={i === 1 ? "" : "opacity-70"}
            />
          </motion.div>
        ))}
      </div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[clamp(2rem,8vw,2.9rem)] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink outline-none"
      >
        Learn the words
        <br />
        that matter.
      </h1>
      <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-muted">
        20–30 useful words every day. Not a course — a ritual.
      </p>
    </div>
  );
}

/* ================================================================== *
 * Step 2 — target language
 * ================================================================== */

function StepTarget({
  headingRef,
  target,
  onTarget,
  query,
  onQuery,
  filtered,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  target: LanguageCode;
  onTarget: (c: LanguageCode) => void;
  query: string;
  onQuery: (q: string) => void;
  filtered: typeof LANGUAGES;
}) {
  const hapticsEnabled = useStore((s) => s.state.settings.hapticsEnabled);

  return (
    <div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[clamp(1.6rem,6vw,2.1rem)] font-extrabold leading-tight tracking-[-0.03em] text-ink outline-none"
      >
        What do you want to learn?
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        Each language ships its own frequency list, ordered by how often it is actually used.
      </p>

      <label className="mt-6 flex h-12 items-center gap-3 rounded-row border border-line bg-surface px-4 focus-within:border-line-strong">
        <Search className="size-4 shrink-0 text-faint" strokeWidth={2.2} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search languages"
          aria-label="Search languages"
          className="h-full w-full bg-transparent text-[14px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-faint"
        />
      </label>

      <div
        className="no-scrollbar mt-4 grid max-h-[46svh] grid-cols-2 gap-2 overflow-y-auto pb-1 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Target language"
      >
        {filtered.map((l) => {
          const active = l.code === target;
          return (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                onTarget(l.code);
                haptics.tick(hapticsEnabled);
              }}
              className={cn(
                "press chrome-noselect flex flex-col items-start gap-3 rounded-row border p-3 text-left",
                active ? "border-ink bg-surface" : "border-line bg-paper hover:bg-surface",
              )}
            >
              <GlyphTile glyph={l.glyph} reading={l.glyphReading} size={44} dense />
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[13.5px] font-semibold text-ink">
                  {l.name}
                  {active && <Check className="size-3.5 text-ink" strokeWidth={3} />}
                </span>
                <span className="mt-1 block truncate text-[11px] text-muted">{l.nativeName}</span>
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-[13px] text-muted">
            No language matches “{query}”. Try another spelling.
          </p>
        )}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Step 3 — native language, with a live preview
 * ================================================================== */

function StepNative({
  headingRef,
  target,
  native,
  onNative,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  target: LanguageCode;
  native: NativeLanguageCode;
  onNative: (c: NativeLanguageCode) => void;
}) {
  const hapticsEnabled = useStore((s) => s.state.settings.hapticsEnabled);
  const sample = getVocabulary(target)[8] ?? getVocabulary(target)[0];

  return (
    <div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[clamp(1.6rem,6vw,2.1rem)] font-extrabold leading-tight tracking-[-0.03em] text-ink outline-none"
      >
        What&rsquo;s your native language?
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        So meanings appear in the language you think in.
      </p>

      {/* The preview is the delight: the answer changes as you tap. */}
      <div className="mt-6 rounded-panel border border-line bg-surface grain relative isolate overflow-hidden pad-panel">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
          On your cards
        </p>
        <div className="flex items-center gap-4">
          <GlyphTile glyph={sample?.word ?? "—"} size={56} dense />
          <div className="min-w-0">
            {sample?.romanized && (
              <p className="font-serif text-[12px] italic text-faint">{sample.romanized}</p>
            )}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={native}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="text-[17px] font-bold tracking-[-0.01em] text-ink"
              >
                {sample ? resolveMeaning(sample, native) : ""}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        {sample && !sample.translations?.[native] && native !== "en" && (
          <p className="mt-3 text-[11px] leading-snug text-faint">
            We don&rsquo;t have a full {NATIVE_LANGUAGES.find((n) => n.code === native)?.name} gloss
            set yet, so you&rsquo;ll see the English meaning for now.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Native language">
        {NATIVE_LANGUAGES.map((n) => {
          const active = n.code === native;
          return (
            <button
              key={n.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                onNative(n.code);
                haptics.tick(hapticsEnabled);
              }}
              className={cn(
                "press chrome-noselect inline-flex items-center gap-2 rounded-full border px-4 py-3 text-[13.5px] font-semibold",
                active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-soft hover:text-ink",
              )}
            >
              {n.name}
              <span className={cn("text-[11px] font-medium", active ? "text-paper/60" : "text-faint")}>
                {n.nativeName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Step 4 — daily goal
 * ================================================================== */

const GOALS: Goal[] = [10, 20, 25, 30];

function StepGoal({
  headingRef,
  goal,
  onGoal,
  minutes,
  daysTo500,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  goal: Goal;
  onGoal: (g: Goal) => void;
  minutes: number;
  daysTo500: number;
}) {
  const hapticsEnabled = useStore((s) => s.state.settings.hapticsEnabled);

  return (
    <div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[clamp(1.6rem,6vw,2.1rem)] font-extrabold leading-tight tracking-[-0.03em] text-ink outline-none"
      >
        How many words a day?
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        Twenty-five is the default. You can change it any time.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Daily goal">
        {GOALS.map((g) => {
          const active = g === goal;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                onGoal(g);
                haptics.tick(hapticsEnabled);
              }}
              className={cn(
                "press chrome-noselect flex flex-col items-center gap-1 rounded-row border py-5",
                active ? "border-ink bg-surface" : "border-line bg-paper hover:bg-surface",
              )}
            >
              <span className="text-[30px] font-extrabold leading-none tracking-[-0.04em] text-ink tabular-nums">
                {g}
              </span>
              <span className="text-[11.5px] font-medium text-muted">words</span>
            </button>
          );
        })}
      </div>

      {/* Live arithmetic — makes the choice concrete instead of abstract. */}
      <div className="mt-5 flex items-center gap-4 rounded-panel border border-line bg-surface grain relative isolate overflow-hidden px-5 py-4">
        <Sparkles className="size-4 shrink-0 text-accent" strokeWidth={2.3} />
        <p className="text-[13px] leading-relaxed text-ink-soft">
          About{" "}
          <span className="font-semibold text-ink tabular-nums">{minutes} minutes</span> a day — and
          roughly{" "}
          <span className="font-semibold text-ink tabular-nums">
            {daysTo500 < 60 ? `${daysTo500} days` : `${Math.round(daysTo500 / 30)} months`}
          </span>{" "}
          to the 500 most useful words.
        </p>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Step 5 — ready
 * ================================================================== */

function StepReady({
  headingRef,
  language,
  native,
  goal,
  previewWords,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  language: ReturnType<typeof getLanguage>;
  native: NativeLanguageCode;
  goal: Goal;
  previewWords: ReturnType<typeof getVocabulary>;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <GlyphTile glyph={language.glyph} reading={language.glyphReading} badge="1" size={104} />
      </motion.div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-7 text-[clamp(1.7rem,6.4vw,2.3rem)] font-extrabold leading-tight tracking-[-0.03em] text-ink outline-none"
      >
        You&rsquo;re ready.
      </h1>
      <p className="mt-3 max-w-xs text-[14.5px] leading-relaxed text-muted">
        Your first <span className="font-semibold text-ink">{goal} {language.name} words</span> are
        waiting.
      </p>

      <div className="mt-7 w-full rounded-panel border border-line bg-surface grain relative isolate overflow-hidden pad-panel">
        <p className="mb-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
          Starting here
        </p>
        <div className="flex flex-col gap-2">
          {previewWords.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
              className="flex items-center gap-3 rounded-chip bg-paper px-3 py-2 text-left"
            >
              <span className="w-6 shrink-0 text-[11px] font-semibold text-faint tabular-nums">
                {w.frequencyRank}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                {w.word}
              </span>
              <span className="min-w-0 truncate text-[12.5px] text-muted">
                {resolveMeaning(w, native)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
