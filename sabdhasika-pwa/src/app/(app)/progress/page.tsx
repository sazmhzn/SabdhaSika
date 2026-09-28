"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StreakChip } from "@/components/celebrate/Flame";
import { PageHeader } from "@/components/nav/AppShell";
import { GlyphTile } from "@/components/ui/GlyphTile";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import {
  frequencyCoverage,
  frequencySample,
  frequencySource,
  type FrequencyEntry,
} from "@/lib/data/frequency";
import { recallStrength } from "@/lib/engine/recall";
import { activityStrip, computeStats, totalRatings } from "@/lib/engine/stats";
import { FREQUENCY_MILESTONES, getLanguage } from "@/lib/languages";
import { useStore } from "@/lib/store";

/**
 * Progress.
 *
 * The brief is explicit: this must feel like unlocking a language, not like
 * reading a spreadsheet. So the page is built around three *shapes* — a
 * stacked mastery bar, a consistency strip, and a vertical milestone ladder —
 * and numbers only ever annotate a shape rather than replacing it.
 *
 * The last card is the one that makes the product checkable: it names the
 * corpus the list was counted from and shows what is actually next in it. A
 * learner can open the source and verify the order for themselves.
 */
export default function ProgressPage() {
  const state = useStore((s) => s.state);
  const stats = useMemo(() => computeStats(state), [state]);
  const strip = useMemo(() => activityStrip(state), [state]);
  const ratings = useMemo(() => totalRatings(state), [state]);
  const recall = useMemo(() => recallStrength(state), [state]);
  const language = getLanguage(state.settings.targetLanguage);

  const seen = stats.wordsLearned;

  // The corpus half of the page. Loaded after paint — the lists are ~3,000
  // entries each and must not sit in the first bundle.
  const [coverage, setCoverage] = useState<number | null>(null);
  const [nextUp, setNextUp] = useState<FrequencyEntry[]>([]);
  const meta = frequencySource(state.settings.targetLanguage);

  useEffect(() => {
    let live = true;
    const code = state.settings.targetLanguage;
    // The claim is about the first hundred words, so measure exactly those.
    Promise.all([frequencyCoverage(code, 100), frequencySample(code, seen + 1, 6)]).then(
      ([cov, sample]) => {
        if (!live) return;
        setCoverage(cov);
        setNextUp(sample);
      },
    );
    return () => {
      live = false;
    };
  }, [state.settings.targetLanguage, seen]);

  const segments = [
    { label: "Mastered", value: stats.mastered, className: "bg-ink" },
    { label: "Familiar", value: stats.familiar, className: "bg-ink/45" },
    { label: "Learning", value: stats.learning, className: "bg-ink/20" },
  ];
  const maxStrip = Math.max(1, ...strip.map((s) => s.count));

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader
        eyebrow={`${language.name} · ${language.frequencyListSize.toLocaleString()} word list`}
        title="Progress"
        trailing={<StreakChip days={state.streak.current} />}
      />

      {/*
        Desktop layout.
        ────────────────
        Two columns from `lg`, with explicit placement so the phone's reading
        order is untouched. The headline and the four review counters take the
        full width; everything else pairs up:

          row 1   words met (full width)
          row 2   consistency      |   the milestone ladder
          row 3   next in the list |   recall from memory
          row 4   review pressure  |   words mastered

        The pairs are chosen so each column holds one "shape" and one number,
        which is the balance the page is built around — see the note at the top
        of the component.
      */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
        {/* ── headline ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
          className="surface-card grain relative isolate overflow-hidden pad-card lg:col-span-2 lg:row-start-1 lg:pad-card-lg"
        >
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                Words met
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-[clamp(2.8rem,13vw,3.8rem)] font-extrabold leading-[0.88] tracking-[-0.05em] text-ink tabular-nums">
                  {seen.toLocaleString()}
                </span>
                <span className="text-[14px] font-semibold text-faint tabular-nums">
                  / {language.frequencyListSize.toLocaleString()}
                </span>
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
                You are working through the <span className="font-semibold text-ink-soft">{stats.bandLabel.toLowerCase()}</span>.
              </p>
            </div>
            <GlyphTile
              glyph={[...String(seen)].slice(-1)[0] ?? "0"}
              reading={`${seen}`}
              size={78}
              dense
            />
          </div>

          {/* stacked mastery bar */}
          <div className="mt-6">
            <div
              className="flex h-3 gap-1 overflow-hidden"
              role="img"
              aria-label={`${stats.mastered} mastered, ${stats.familiar} familiar, ${stats.learning} learning`}
            >
              {segments.map((s) =>
                Array.from({ length: s.value }).map((_, i) => (
                  <motion.span
                    key={`${s.label}-${i}`}
                    initial={{ scaleY: 0.3, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.004, 0.25), duration: 0.3 }}
                    className={cn("flex-1 rounded-full", s.className)}
                  />
                )),
              )}
              {seen === 0 && <span className="flex-1 rounded-full bg-surface-2" />}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {segments.map((s) => (
                <span key={s.label} className="flex items-center gap-2 text-[12px] text-muted">
                  <span className={cn("size-2 rounded-full", s.className)} aria-hidden="true" />
                  <span className="font-semibold text-ink-soft tabular-nums">{s.value}</span>
                  {s.label}
                </span>
              ))}
              <span className="flex items-center gap-2 text-[12px] text-muted">
                <span className="size-2 rounded-full border border-line bg-paper" aria-hidden="true" />
                <span className="font-semibold text-ink-soft tabular-nums">
                  {Math.max(0, language.frequencyListSize - seen)}
                </span>
                untouched
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── consistency ───────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07, duration: 0.4 }}
          className="mt-3 rounded-panel border border-line bg-paper pad-panel lg:col-start-1 lg:row-start-2 lg:mt-0"
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              Last four weeks
            </p>
            <p className="text-[12px] text-muted tabular-nums">
              {strip.filter((s) => s.active).length} active days
            </p>
          </div>

          <div className="mt-4 flex h-14 items-end gap-1" role="img" aria-label="Daily activity for the last 28 days">
            {strip.map((d) => (
              <motion.span
                key={d.date}
                initial={{ scaleY: 0.2, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                title={`${d.date} — ${d.count} cards`}
                style={{ height: `${d.active ? 34 + (d.count / maxStrip) * 66 : 14}%` }}
                className={cn(
                  "flex-1 origin-bottom rounded-full",
                  d.active ? "bg-ink" : "bg-surface-2",
                )}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-[12px] text-muted">
              Longest streak{" "}
              <span className="font-semibold text-ink-soft tabular-nums">
                {state.streak.longest}
              </span>
            </span>
            <span className="text-[12px] text-muted">
              Cards answered{" "}
              <span className="font-semibold text-ink-soft tabular-nums">
                {ratings.toLocaleString()}
              </span>
            </span>
          </div>
        </motion.section>

        {/* ── frequency ladder ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          className="mt-3 rounded-panel border border-line bg-paper pad-panel lg:col-start-2 lg:row-start-2 lg:mt-0"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            Frequency journey
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Each milestone is a real threshold.{" "}
            {coverage === null ? (
              <>The first hundred words are simply the ones you meet most often.</>
            ) : (
              <>
                The first hundred words alone account for{" "}
                <span className="font-semibold text-ink-soft tabular-nums">
                  {Math.round(coverage * 100)}%
                </span>{" "}
                of every word in the corpus this list was counted from.
              </>
            )}
          </p>

          <ol className="relative mt-5">
            {/* the spine */}
            <span
              className="absolute left-[11px] top-2 bottom-2 w-px bg-line"
              aria-hidden="true"
            />
            <motion.span
              className="absolute left-[11px] top-2 w-px bg-ink"
              initial={{ height: 0 }}
              animate={{
                height: `${Math.min(100, (seen / FREQUENCY_MILESTONES[FREQUENCY_MILESTONES.length - 1]) * 100)}%`,
              }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              aria-hidden="true"
            />

            {FREQUENCY_MILESTONES.map((m, i) => {
              const reached = seen >= m;
              const current = !reached && (i === 0 || seen >= FREQUENCY_MILESTONES[i - 1]);
              return (
                <li key={m} className="relative flex items-center gap-4 py-3 pl-0">
                  <span
                    className={cn(
                      "relative z-10 grid size-[23px] shrink-0 place-items-center rounded-full border-2 bg-paper",
                      reached
                        ? "border-ink bg-ink"
                        : current
                          ? "border-ink"
                          : "border-line",
                    )}
                    aria-hidden="true"
                  >
                    {reached ? (
                      <Check className="size-3 text-paper" strokeWidth={3.4} />
                    ) : current ? (
                      <span className="size-2 rounded-full bg-ink" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                    <span
                      className={cn(
                        "text-[14px] font-bold tabular-nums",
                        reached ? "text-ink" : current ? "text-ink" : "text-faint",
                      )}
                    >
                      {m.toLocaleString()} words
                    </span>
                    <span className="text-[11.5px] text-faint">
                      {reached
                        ? "reached"
                        : current
                          ? `${(m - seen).toLocaleString()} to go`
                          : "locked"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </motion.section>

        {/* ── the corpus itself ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4 }}
          className="mt-3 rounded-panel border border-line bg-paper pad-panel lg:col-start-1 lg:row-start-3 lg:mt-0"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            Next in the list
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Not a preview of your session — the actual next entries in the corpus ranking.
          </p>

          {nextUp.length > 0 ? (
            <ol className="mt-4 flex flex-wrap gap-2">
              {nextUp.map((entry) => (
                <li
                  key={entry.rank}
                  className="flex items-baseline gap-2 rounded-chip border border-line bg-surface-2 px-3 py-2"
                >
                  <span className="font-serif text-[11px] tabular-nums text-faint">{entry.rank}</span>
                  <span
                    className="text-[14.5px] font-semibold text-ink"
                    lang={language.code}
                    dir={language.code === "ar" ? "rtl" : "ltr"}
                  >
                    {entry.word}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-4 h-8 rounded-chip bg-surface-2" aria-hidden="true" />
          )}

          {meta && (
            <p className="mt-5 border-t border-line pt-4 text-[11.5px] leading-relaxed text-faint">
              Ranked by how often each word occurs in{" "}
              <a
                href={meta.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-muted underline decoration-line underline-offset-2 transition-colors hover:text-ink"
              >
                {meta.source}
              </a>
              {" · "}
              {meta.licence}
              {meta.totalTokens !== null && <> · {meta.totalTokens.toLocaleString()} tokens counted</>}
              {!meta.hasCounts && <> · ranks only, the source publishes no counts</>}
            </p>
          )}
        </motion.section>

        {/* ── recall: the number that measures learning, not comfort ─── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.4 }}
          className="mt-3 rounded-panel border border-line bg-paper pad-panel lg:col-start-2 lg:row-start-3 lg:mt-0"
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              Recall from memory
            </p>
            <p className="text-[12px] text-muted tabular-nums">
              {recall.total > 0 ? `${recall.remembered} of ${recall.total}` : "no attempts yet"}
            </p>
          </div>

          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
              {recall.rate === null ? "—" : `${Math.round(recall.rate * 100)}%`}
            </span>
            <span className="text-[12.5px] text-muted">produced before looking</span>
          </p>

          <ProgressBar
            value={recall.remembered}
            max={Math.max(1, recall.total)}
            height={7}
            className="mt-4"
            label="Recall strength"
          />

          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            {recall.total === 0
              ? "Run a recall drill and this becomes the honest measure of what you can actually produce."
              : "Recognising a word is not the same as being able to say it. This is the harder half."}
          </p>
        </motion.section>

        {/* ── review pressure ───────────────────────────────────────── */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-start-1 lg:row-start-4 lg:mt-0">
          {[
            { label: "Due today", value: stats.dueToday },
            { label: "Difficult", value: stats.difficult },
            { label: "Slipped away", value: stats.forgotten },
            { label: "New this week", value: stats.recentlyLearned },
          ].map((s) => (
            <div key={s.label} className="rounded-panel border border-line bg-paper p-4">
              <p className="text-[20px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
                {s.value}
              </p>
              <p className="mt-2 text-[11.5px] font-medium text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-panel border border-line bg-paper pad-panel lg:col-start-2 lg:row-start-4 lg:mt-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            Words mastered
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
              {stats.mastered.toLocaleString()}
            </span>
            <span className="text-[12.5px] text-muted">
              {seen > 0 ? `${Math.round(stats.masteryRatio * 100)}% of everything you've met` : "nothing met yet"}
            </span>
          </p>
          <ProgressBar
            value={stats.mastered}
            max={Math.max(1, seen)}
            height={7}
            className="mt-4"
            label="Mastery ratio"
          />
        </div>
      </div>
    </div>
  );
}
