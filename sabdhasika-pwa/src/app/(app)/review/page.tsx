"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/nav/AppShell";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { resolveMeaning } from "@/lib/data";
import { buildReviewBuckets, type ReviewBucketId } from "@/lib/engine/stats";
import { getLanguage } from "@/lib/languages";
import { useStore } from "@/lib/store";
import type { VocabularyWord } from "@/lib/types";

const MAX_SESSION = 20;

export default function ReviewPage() {
  const router = useRouter();
  const state = useStore((s) => s.state);
  const startReviewSession = useStore((s) => s.startReviewSession);

  const buckets = useMemo(() => buildReviewBuckets(state), [state]);
  const [tab, setTab] = useState<ReviewBucketId>("due");

  const active = buckets.find((b) => b.id === tab) ?? buckets[0];
  const attention = useMemo(() => {
    const seen = new Set<string>();
    const out: VocabularyWord[] = [];
    for (const b of [buckets[0], buckets[1], buckets[2]]) {
      for (const w of b.words) {
        if (seen.has(w.id)) continue;
        seen.add(w.id);
        out.push(w);
      }
    }
    return out;
  }, [buckets]);

  const language = getLanguage(state.settings.targetLanguage);

  const start = (ids: string[]) => {
    if (ids.length === 0) return;
    startReviewSession(ids.slice(0, MAX_SESSION));
    router.push("/session");
  };

  const nothingAtAll = buckets.every((b) => b.words.length === 0);

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader eyebrow={`${language.name} · ${language.frequencyListSize.toLocaleString()} words`} title="Review" />

      {nothingAtAll ? (
        <EmptyState
          glyph="✓"
          reading="clear"
          title="Nothing needs attention"
          body="Every word you've met is holding. New words will start showing up here as soon as a few get shaky."
          action={
            <Button size="lg" onClick={() => router.push("/learn")}>
              Today&apos;s words
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </Button>
          }
        />
      ) : (
        <>
          {/* ── the headline number ─────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="surface-card grain relative isolate overflow-hidden pad-card lg:pad-card-lg"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
              Needs attention
            </p>
            <p className="mt-2 flex items-baseline gap-3">
              <span className="text-[clamp(2.6rem,12vw,3.4rem)] font-extrabold leading-[0.9] tracking-[-0.045em] text-ink tabular-nums">
                {attention.length}
              </span>
              <span className="pb-2 text-[14px] font-semibold text-muted">
                {attention.length === 1 ? "word" : "words"}
              </span>
            </p>
            <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-muted">
              These came back sooner because you rated them Hard, missed them, or they were due.
            </p>
            <Button
              size="lg"
              className="mt-5"
              onClick={() => start(attention.map((w) => w.id))}
            >
              Review {Math.min(attention.length, MAX_SESSION)} now
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </Button>
          </motion.section>

          {/* ── buckets ─────────────────────────────────────────────── */}
          <div className="mt-5">
            <Segmented
              ariaLabel="Review category"
              value={tab}
              onChange={(v) => setTab(v as ReviewBucketId)}
              size="sm"
              options={buckets.map((b) => ({
                value: b.id,
                label: `${b.label} ${b.words.length}`,
              }))}
            />

            <p className="mt-3 px-1 text-[12px] text-muted">{active.hint}</p>

            {active.words.length === 0 ? (
              <p className="mt-6 rounded-panel border border-dashed border-line px-5 py-8 text-center text-[13px] text-muted">
                Nothing in this bucket. That is a good sign.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {active.words.slice(0, 40).map((w, i) => (
                  <WordRow
                    key={w.id}
                    index={i}
                    word={w}
                    meaning={resolveMeaning(w, state.settings.nativeLanguage)}
                    status={state.progress[w.id]?.status ?? "new"}
                    difficulty={state.progress[w.id]?.difficulty ?? 0}
                    lapses={state.progress[w.id]?.lapses ?? 0}
                  />
                ))}
              </ul>
            )}

            {active.words.length > 0 && (
              <Button
                variant="secondary"
                full
                className="mt-3"
                onClick={() => start(active.words.map((w) => w.id))}
              >
                <Sparkles className="size-4" strokeWidth={2.3} />
                Practise just these
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function WordRow({
  word,
  meaning,
  status,
  difficulty,
  lapses,
  index,
}: {
  word: VocabularyWord;
  meaning: string;
  status: string;
  difficulty: number;
  lapses: number;
  index: number;
}) {
  const tone =
    difficulty >= 0.7 ? "bad" : difficulty >= 0.45 ? "warn" : "good";

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.022, 0.3), duration: 0.3 }}
      className="flex items-center gap-4 rounded-row border border-line bg-paper px-4 py-3"
    >
      <span className="w-7 shrink-0 text-[11px] font-semibold text-faint tabular-nums">
        {word.frequencyRank}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            lang={word.language}
            className="truncate text-[16px] font-bold tracking-[-0.01em] text-ink"
          >
            {word.word}
          </span>
          {word.romanized && (
            <span className="truncate font-serif text-[12px] italic text-faint">
              {word.romanized}
            </span>
          )}
        </span>
        <span className="mt-1 block truncate text-[12.5px] text-muted">{meaning}</span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">
          {status}
        </span>
        {/* Three dots = a difficulty scale. Shape, not colour alone. */}
        <span
          className="flex items-center gap-1"
          role="img"
          aria-label={`Difficulty: ${Math.round(difficulty * 100)} percent`}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "size-1.5 rounded-full",
                i < Math.max(1, Math.ceil(difficulty * 3))
                  ? tone === "bad"
                    ? "bg-bad"
                    : tone === "warn"
                      ? "bg-accent"
                      : "bg-good"
                  : "bg-line-strong",
              )}
            />
          ))}
          {lapses >= 2 && <span className="ml-1 text-[10px] font-bold text-bad">×{lapses}</span>}
        </span>
      </span>
    </motion.li>
  );
}
