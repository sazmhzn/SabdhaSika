"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CornerDownLeft, RotateCcw, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MilestoneOverlay, crossedMilestone } from "@/components/celebrate/MilestoneOverlay";
import { SessionComplete } from "@/components/celebrate/SessionComplete";
import { Flame } from "@/components/celebrate/Flame";
import { Flashcard } from "@/components/learn/Flashcard";
import { PronunciationButton, requestSpeak } from "@/components/learn/PronunciationButton";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { getVocabulary, resolveMeaning } from "@/lib/data";
import { dayKey } from "@/lib/date";
import { ratingKey, type QueuedCard } from "@/lib/engine/session";
import { computeStats } from "@/lib/engine/stats";
import { getLanguage } from "@/lib/languages";
import { useHasKeyboard } from "@/lib/hooks";
import { track } from "@/lib/metrics";
import { shouldShowRomanization } from "@/lib/romanization";
import { useStore } from "@/lib/store";

/**
 * The learning session.
 *
 * Full screen, no navigation chrome, one card at a time. Everything the
 * learner needs to know is in the top bar (how far through, and the streak);
 * everything they can *do* is on the card. The desktop layout adds a rail
 * that the mobile layout genuinely cannot have — shortcuts and a look-ahead
 * queue — rather than a wider version of the same column.
 */
export default function SessionPage() {
  const router = useRouter();
  const hasKeyboard = useHasKeyboard();

  const state = useStore((s) => s.state);
  const reviewSession = useStore((s) => s.reviewSession);
  const rate = useStore((s) => s.rate);
  const defer = useStore((s) => s.defer);
  const undoLast = useStore((s) => s.undoLast);
  const history = useStore((s) => s.history);
  const endReviewSession = useStore((s) => s.endReviewSession);
  const ensureDailySession = useStore((s) => s.ensureDailySession);

  const { settings } = state;
  const language = getLanguage(settings.targetLanguage);

  useEffect(() => {
    if (!reviewSession) ensureDailySession();
  }, [ensureDailySession, reviewSession]);

  const session = reviewSession ?? state.sessions[dayKey()] ?? null;

  const vocab = useMemo(() => getVocabulary(settings.targetLanguage), [settings.targetLanguage]);
  const byId = useMemo(() => new Map(vocab.map((w) => [w.id, w])), [vocab]);

  /* ── the queue, derived entirely from persisted state ─────────────── */
  const queue = useMemo<QueuedCard[]>(() => {
    if (!session) return [];
    const first: QueuedCard[] = session.wordIds.map((wordId) => ({ wordId, pass: 1 }));
    const retry: QueuedCard[] = session.wordIds
      .filter((id) => session.ratings[`${id}#1`] === "hard")
      .map((wordId) => ({ wordId, pass: 2 }));
    const deferrals = session.deferrals ?? {};
    first.sort(
      (a, b) =>
        (deferrals[a.wordId] ?? 0) - (deferrals[b.wordId] ?? 0) ||
        session.wordIds.indexOf(a.wordId) - session.wordIds.indexOf(b.wordId),
    );
    return [...first, ...retry];
  }, [session]);

  const done = useMemo(
    () => queue.filter((c) => session?.ratings[ratingKey(c)]).length,
    [queue, session],
  );
  const remaining = useMemo(
    () => queue.filter((c) => !session?.ratings[ratingKey(c)]),
    [queue, session],
  );

  const current = remaining[0] ?? null;
  const total = queue.length;
  const complete = Boolean(session) && total > 0 && remaining.length === 0;

  /* ── milestone detection ──────────────────────────────────────────── */
  const stats = useMemo(() => computeStats(state), [state]);
  const [milestone, setMilestone] = useState<number | null>(null);
  const beforeRef = useRef<number | null>(null);

  useEffect(() => {
    if (beforeRef.current === null) beforeRef.current = session?.wordsAtStart ?? stats.wordsLearned;
  }, [session?.wordsAtStart, stats.wordsLearned]);

  useEffect(() => {
    if (!complete) return;
    const hit = crossedMilestone(
      beforeRef.current ?? 0,
      stats.wordsLearned,
      state.celebratedMilestones,
    );
    if (hit) setMilestone(hit);
  }, [complete, state.celebratedMilestones, stats.wordsLearned]);

  /* ── first card ready: the metric that says the app is fast ───────── */
  const readyTracked = useRef(false);
  useEffect(() => {
    if (readyTracked.current || !session || complete) return;
    readyTracked.current = true;
    track("first_card_ready", { ms: 0 });
    if (!navigator.onLine) track("offline_session");
  }, [complete, session]);

  /* ── keyboard: undo, skip, replay ─────────────────────────────────── */
  const onRate = useCallback(
    (card: QueuedCard, rating: Parameters<typeof rate>[1]) => {
      rate(card, rating);
    },
    [rate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (!current) return;

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        requestSpeak(byId.get(current.wordId)?.word ?? "");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        defer(current);
      }
      if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undoLast();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [byId, current, defer, undoLast]);

  /* ── exit ─────────────────────────────────────────────────────────── */
  const exit = useCallback(() => {
    if (reviewSession) endReviewSession();
    router.push("/learn");
  }, [endReviewSession, reviewSession, router]);

  /* ── guards ───────────────────────────────────────────────────────── */
  if (!session) {
    return (
      <div className="grid min-h-svh place-items-center px-6">
        <div className="skeleton h-40 w-full max-w-md rounded-card" />
      </div>
    );
  }

  if (session.wordIds.length === 0) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center">
        <EmptyState
          glyph="अ"
          reading="a"
          title="Nothing to learn yet"
          body="There are no words queued for this language. Pick another language in Settings and today's list will be ready."
          action={
            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="press inline-flex h-12 items-center rounded-row bg-ink px-6 text-[14px] font-semibold text-paper"
            >
              Open settings
            </button>
          }
        />
      </main>
    );
  }

  if (complete) {
    return (
      <>
        <SessionComplete
          wordsDone={session.wordIds.length}
          newCount={session.newCount}
          reviewCount={session.reviewCount}
          wordsBefore={session.wordsAtStart ?? 0}
          wordsAfter={stats.wordsLearned}
          onDone={exit}
        />
        <MilestoneOverlay milestone={milestone} onDismiss={() => setMilestone(null)} />
      </>
    );
  }

  const word = current ? byId.get(current.wordId) : null;
  if (!current || !word) {
    return (
      <div className="grid min-h-svh place-items-center px-6">
        <div className="skeleton h-40 w-full max-w-md rounded-card" />
      </div>
    );
  }

  const wordProgress = state.progress[current.wordId];
  const showRomanization = shouldShowRomanization(
    settings.romanization,
    wordProgress?.status ?? "new",
  );
  const mode = session.modes[current.wordId] ?? "reveal";
  /* A word met for the first time is a *lesson*, not a test: it has never
     been recalled, so it must not end on a self-assessment question. The
     second-chance pass after a "hard" rating is a real attempt, so it keeps
     the rating bar. */
  const firstExposure = current.pass === 1 && (wordProgress?.status ?? "new") === "new";

  return (
    <div className="flex min-h-svh flex-col">
      {/* ── top bar ─────────────────────────────────────────────────── */}
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <IconButton label="Leave session" tone="plain" onClick={exit}>
            <X className="size-5" strokeWidth={2.2} />
          </IconButton>

          <div className="flex items-center gap-3">
            <ProgressBar
              value={done}
              max={total}
              className="w-24 sm:w-40"
              height={6}
              label="Session progress"
            />
            <span className="text-[12.5px] font-semibold text-muted tabular-nums">
              {done}
              <span className="text-faint"> / {total}</span>
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={undoLast}
            disabled={history.length === 0}
            aria-label="Undo last rating"
            title="Undo last rating (Ctrl+Z)"
            className={cn(
              "press grid size-9 place-items-center rounded-full border border-transparent text-muted",
              "hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30",
            )}
          >
            <Undo2 className="size-4" strokeWidth={2.2} />
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink">
            <Flame size={13} active={state.streak.current > 0} />
            {state.streak.current}
          </span>
        </div>
      </header>

      {/* ── body ────────────────────────────────────────────────────── */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 items-start gap-8 px-5 pb-safe pt-4">
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${current.wordId}#${current.pass}`}
              initial={{ opacity: 0, x: 26, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -22, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <Flashcard
                word={word}
                vocabulary={vocab}
                language={language}
                nativeLanguage={settings.nativeLanguage}
                progress={wordProgress}
                mode={mode}
                pass={current.pass}
                firstExposure={firstExposure}
                showRomanization={showRomanization}
                showHints={hasKeyboard}
                autoPlay={settings.autoPlayPronunciation && firstExposure}
                pronunciationEnabled={settings.pronunciationEnabled}
                hapticsEnabled={settings.hapticsEnabled}
                onRate={(rating) => onRate(current, rating)}
              />
            </motion.div>
          </AnimatePresence>

          {/* mobile-only escape hatches */}
          <div className="mt-4 flex w-full items-center justify-between gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => defer(current)}
              disabled={current.pass === 2}
              className="press inline-flex h-10 items-center gap-2 rounded-chip px-3 text-[13px] font-semibold text-muted disabled:opacity-30"
            >
              <ArrowRight className="size-3.5" strokeWidth={2.4} />
              Skip for now
            </button>
            <button
              type="button"
              onClick={undoLast}
              disabled={history.length === 0}
              className="press inline-flex h-10 items-center gap-2 rounded-chip px-3 text-[13px] font-semibold text-muted disabled:opacity-30"
            >
              <Undo2 className="size-3.5" strokeWidth={2.4} />
              Undo
            </button>
          </div>
        </div>

        {/* ── desktop rail: context the mobile layout cannot carry ───── */}
        <aside className="sticky top-6 hidden w-64 shrink-0 flex-col gap-3 lg:flex">
          <div className="rounded-panel border border-line bg-paper pad-panel">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              Shortcuts
            </p>
            <ul className="mt-3 space-y-2">
              {[
                { keys: ["Space"], label: "Reveal" },
                { keys: ["1", "2", "3"], label: "Hard · Good · Easy" },
                { keys: ["R"], label: "Replay pronunciation" },
                { keys: ["→"], label: "Skip for now" },
                { keys: ["⌘", "Z"], label: "Undo last rating" },
              ].map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-muted">{s.label}</span>
                  <span className="flex gap-1">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-panel border border-line bg-paper pad-panel">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              Up next
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {remaining.length - 1 > 0
                ? `${remaining.length - 1} more after this one`
                : "This is the last one"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {remaining.slice(1, 9).map((c, i) => {
                const w = byId.get(c.wordId);
                if (!w) return null;
                return (
                  <span
                    key={`${c.wordId}#${c.pass}`}
                    title={
                      settings.pronunciationEnabled
                        ? resolveMeaning(w, settings.nativeLanguage)
                        : undefined
                    }
                    className={cn(
                      "grid size-9 place-items-center rounded-chip border border-line bg-surface text-[14px] font-semibold text-ink/60",
                      i > 4 && "opacity-45",
                    )}
                    aria-hidden="true"
                  >
                    {[...w.word][0]}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="rounded-panel border border-line bg-paper pad-panel">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              Today
            </p>
            <dl className="mt-3 space-y-2 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-muted">New</dt>
                <dd className="font-semibold text-ink tabular-nums">{session.newCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Review</dt>
                <dd className="font-semibold text-ink tabular-nums">{session.reviewCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">List position</dt>
                <dd className="font-semibold text-ink tabular-nums">#{word.frequencyRank}</dd>
              </div>
              {word.frequency !== undefined && (
                <div className="flex justify-between">
                  <dt className="text-muted">Seen in corpus</dt>
                  <dd className="font-semibold text-ink tabular-nums">
                    {word.frequency.toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* A signed language has no voice, so there is nothing to play. */}
          {settings.pronunciationEnabled && language.bcp47 && (
            <div className="flex items-center gap-2 rounded-panel border border-line bg-paper pad-panel">
              <PronunciationButton
                text={word.word}
                bcp47={language.bcp47}
                hint={word.pronunciation}
                size="sm"
                hapticsEnabled={settings.hapticsEnabled}
              />
              <span className="text-[12px] text-muted">Hear it again</span>
            </div>
          )}

          <p className="flex items-center gap-2 px-1 text-[11px] text-faint">
            <CornerDownLeft className="size-3" strokeWidth={2.2} />
            Progress is saved after every card
          </p>
        </aside>
      </div>
    </div>
  );
}
