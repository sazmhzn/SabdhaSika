"use client";

import { motion } from "framer-motion";
import { ArrowRight, Brain, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { StreakChip } from "@/components/celebrate/Flame";
import { WordChart } from "@/components/learn/WordChart";
import { PageHeader } from "@/components/nav/AppShell";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { getVocabulary, resolveMeaning } from "@/lib/data";
import { daysBetween, dayKey, greeting } from "@/lib/date";
import { recallReadyCount } from "@/lib/engine/recall";
import { deriveQueue } from "@/lib/engine/session";
import { computeStats } from "@/lib/engine/stats";
import { getLanguage } from "@/lib/languages";
import { useStore } from "@/lib/store";

/**
 * The home screen.
 *
 * One number dominates: how many words are left today. Everything else —
 * frequency progress, streak, the mix of new versus review — is supporting
 * evidence that the number is worth finishing. No charts on this screen: the
 * spec is explicit that this must not read as an analytics dashboard.
 */
export default function LearnPage() {
  const state = useStore((s) => s.state);
  const ensureDailySession = useStore((s) => s.ensureDailySession);

  const { settings, streak } = state;
  const language = getLanguage(settings.targetLanguage);
  const stats = useMemo(() => computeStats(state), [state]);

  // Self-heal across a calendar day boundary: if the app was left open past
  // midnight, today's list does not exist yet. Building it on mount means the
  // screen never shows "0 words left" to a learner who has simply not reloaded.
  useEffect(() => {
    ensureDailySession();
  }, [ensureDailySession]);

  const session = state.sessions[dayKey()];
  const queue = useMemo(() => (session ? deriveQueue(session) : []), [session]);
  const done = queue.filter((c) => session?.ratings[`${c.wordId}#${c.pass}`]).length;
  const remaining = queue.length - done;
  const finished = queue.length > 0 && remaining === 0;

  const dayNumber = state.onboardedAt ? daysBetween(state.onboardedAt.slice(0, 10), dayKey()) + 1 : 1;

  /* The whole vocabulary, rank-ordered. The chart takes the first twenty from
     it directly rather than re-sorting or filtering by part of speech. */
  const vocabulary = useMemo(() => getVocabulary(settings.targetLanguage), [settings.targetLanguage]);

  // The words about to be met — anticipation, not a preview of answers.
  const upcoming = useMemo(() => {
    if (!session || finished) return [];
    const vocab = getVocabulary(settings.targetLanguage);
    const byId = new Map(vocab.map((w) => [w.id, w]));
    return queue
      .filter((c) => !session.ratings[`${c.wordId}#${c.pass}`])
      .slice(0, 5)
      .map((c) => byId.get(c.wordId))
      .filter(Boolean);
  }, [finished, queue, session, settings.targetLanguage]);

  const newCount = session?.newCount ?? 0;
  const reviewCount = session?.reviewCount ?? 0;
  const total = newCount + reviewCount || settings.dailyGoal;

  // True when `estimateCapacity` has sized the day below the learner's own goal.
  // Worth saying out loud: a number that quietly shrinks would otherwise read as
  // the app failing them.
  const shorterThanGoal = Boolean(
    session && session.wordIds.length > 0 && session.wordIds.length < settings.dailyGoal,
  );

  // The recall drill is a bonus, so it is advertised rather than pushed: a
  // single quiet row, and only once there is something worth drilling.
  const recallReady = useMemo(() => recallReadyCount(state), [state]);

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader
        eyebrow={`${greeting()} · Day ${dayNumber}`}
        title={language.name}
        trailing={<StreakChip days={streak.current} />}
      />

      {/*
        Desktop layout.
        ────────────────
        From `lg` this becomes a two-column grid with explicit placement, so the
        DOM order — which is the phone order — is left completely alone. The
        phone reads today → frequency → chart → recall → stats, exactly as
        before; the desktop reads:

          row 1   today's card (full width, split internally)
          row 2   frequency journey   |   recall drill
          row 3   the first 20 words (full width, ten to a row)
          row 4   the three counters

        Placement is explicit rather than automatic because auto-placement
        cannot put the recall row beside the frequency panel: the chart between
        them wants the full width, and the flow would leave a hole in row 2.
      */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
        {/* ── today's card ──────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
          className="surface-card grain relative isolate overflow-hidden pad-card lg:col-span-2 lg:row-start-1 lg:pad-card-lg"
        >
          {finished ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full bg-good-soft px-3 py-1 text-[11px] font-semibold text-good">
                <Check className="size-3.5" strokeWidth={3} />
                Done for today
              </span>
              <h2 className="mt-4 text-[30px] font-extrabold leading-tight tracking-[-0.035em] text-ink lg:text-[36px]">
                {session?.wordIds.length ?? settings.dailyGoal} words
                <span className="block text-[15px] font-semibold tracking-normal text-muted">
                  finished. Come back tomorrow.
                </span>
              </h2>
              <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-muted">
                {stats.toNextMilestone > 0
                  ? `${stats.toNextMilestone} more words and you'll have the top ${stats.nextMilestone}.`
                  : "You've reached the top of the list."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {stats.dueToday > 0 && (
                  <Link href="/review">
                    <Button size="lg">
                      Review {stats.dueToday} due
                      <ArrowRight className="size-4" strokeWidth={2.4} />
                    </Button>
                  </Link>
                )}
                <Link href="/progress">
                  <Button size="lg" variant="secondary">
                    See progress
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            /*
              At `lg` the card splits: the count and its progress on the left,
              what is coming next and the button on the right. A full-width button
              beneath a full-width progress bar is the shape a phone wants; in a
              1040px card it is a lot of empty space with a button floating in it.
            */
            <div className="lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                  {done > 0 ? "In progress" : "Today's words"}
                </p>

                <div className="mt-2 flex items-end gap-3">
                  <motion.span
                    key={remaining}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-[clamp(3.4rem,15vw,4.6rem)] font-extrabold leading-[0.9] tracking-[-0.05em] text-ink tabular-nums"
                  >
                    {remaining}
                  </motion.span>
                  <span className="pb-2 text-[14px] font-semibold text-muted">
                    {remaining === 1 ? "word left" : "words left"}
                  </span>
                </div>

                {/* new vs review — a shape, not a legend */}
                <div className="mt-5">
                  <div className="flex h-2.5 gap-1 overflow-hidden" aria-hidden="true">
                    {Array.from({ length: total }).map((_, i) => {
                      const isNew = i < newCount;
                      const isDone = i < done;
                      return (
                        <motion.span
                          key={i}
                          initial={{ scaleY: 0.4, opacity: 0 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          transition={{ delay: i * 0.008, duration: 0.3 }}
                          className={cn(
                            "flex-1 rounded-full",
                            isDone ? "bg-ink" : isNew ? "bg-ink/25" : "bg-ink/10",
                          )}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[12.5px] text-muted">
                    <span className="font-semibold text-ink-soft tabular-nums">{newCount}</span> new
                    <span className="mx-2 text-faint">·</span>
                    <span className="font-semibold text-ink-soft tabular-nums">{reviewCount}</span>{" "}
                    review
                    {done > 0 && (
                      <>
                        <span className="mx-2 text-faint">·</span>
                        <span className="font-semibold text-ink-soft tabular-nums">{done}</span> done
                      </>
                    )}
                  </p>
                  {/* The day's size adapts to how the last few days went. Saying
                      so stops the number reading as a quota the learner is
                      failing, which is how a fixed daily goal erodes trust. */}
                  {shorterThanGoal && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                      A lighter day — sized to how the last few went. Your goal of{" "}
                      {settings.dailyGoal} is still the ceiling.
                    </p>
                  )}
                </div>
              </div>

              <div>
                {/* the words themselves, as glyphs */}
                {upcoming.length > 0 && done === 0 && (
                  <div className="mt-5 flex items-center gap-2 lg:mt-0">
                    {upcoming.map((w, i) => (
                      <motion.span
                        key={w!.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.06, duration: 0.32 }}
                        className="grid size-11 place-items-center rounded-chip border border-line bg-paper/70 text-[17px] font-semibold text-ink/70"
                        title={resolveMeaning(w!, settings.nativeLanguage)}
                        aria-hidden="true"
                      >
                        {[...w!.word][0]}
                      </motion.span>
                    ))}
                    {remaining > 5 && (
                      <span className="text-[12px] font-medium text-faint">
                        +{remaining - 5} more
                      </span>
                    )}
                  </div>
                )}

                <Link href="/session" className="mt-6 block" onClick={ensureDailySession}>
                  <Button size="lg" full className="h-14">
                    {done > 0 ? (
                      <>
                        <RotateCcw className="size-4" strokeWidth={2.4} />
                        Continue
                      </>
                    ) : (
                      <>
                        Start Learning
                        <ArrowRight className="size-4" strokeWidth={2.4} />
                      </>
                    )}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </motion.section>

        {/* ── frequency journey ─────────────────────────────────────── */}
        <FrequencyStrip
          learned={stats.wordsLearned}
          listSize={language.frequencyListSize}
          nextMilestone={stats.nextMilestone}
          toNext={stats.toNextMilestone}
          band={stats.bandLabel}
          className="lg:col-start-1 lg:row-start-2 lg:mt-0"
        />

        {/* ── the language's shape: its most frequent words ─────────── */}
        <WordChart
          words={vocabulary}
          language={language}
          nativeLanguage={settings.nativeLanguage}
          className="mt-3 lg:col-span-2 lg:row-start-3 lg:mt-0"
        />

        {/* ── the other direction: recall ───────────────────────────── */}
        {recallReady > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-start-2 lg:row-start-2"
          >
            <Link
              href="/recall"
              className="press lift mt-3 flex items-center gap-4 rounded-panel border border-line bg-paper pad-panel lg:mt-0"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-chip border border-line bg-surface text-ink-soft">
                <Brain className="size-5" strokeWidth={2.1} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-ink">Recall drill</span>
                <span className="mt-1 block text-[12.5px] text-muted">
                  {recallReady} {recallReady === 1 ? "word" : "words"} ready — say them from memory
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-faint" strokeWidth={2.4} />
            </Link>
          </motion.div>
        )}

        {/* ── secondary stats ───────────────────────────────────────── */}
        <div className="mt-3 grid grid-cols-3 gap-3 lg:col-span-2 lg:row-start-4 lg:mt-0">
          {[
            { label: "Mastered", value: stats.mastered },
            { label: "Learning", value: stats.learning + stats.familiar },
            { label: "Needs review", value: stats.dueToday },
          ].map((s) => (
            <div key={s.label} className="rounded-panel border border-line bg-paper p-4">
              <p className="text-[20px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
                {s.value}
              </p>
              <p className="mt-2 text-[11.5px] font-medium text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FrequencyStrip({
  learned,
  listSize,
  nextMilestone,
  toNext,
  band,
  className,
}: {
  learned: number;
  listSize: number;
  nextMilestone: number;
  toNext: number;
  band: string;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={cn("mt-3 rounded-panel border border-line bg-paper pad-panel", className)}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            Frequency journey
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[24px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
              {learned.toLocaleString()}
            </span>
            <span className="text-[13px] font-medium text-faint tabular-nums">
              / {listSize.toLocaleString()}
            </span>
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-muted">
          {band}
        </span>
      </div>

      <ProgressBar
        value={learned}
        max={listSize}
        height={8}
        className="mt-4"
        label="Vocabulary progress"
      />

      <p className="mt-3 text-[12.5px] text-muted">
        Next milestone{" "}
        <span className="font-semibold text-ink-soft tabular-nums">{nextMilestone} words</span>
        <span className="mx-2 text-faint">·</span>
        <span className="tabular-nums">{toNext}</span> to go
      </p>
    </motion.section>
  );
}
