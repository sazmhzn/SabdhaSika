"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { LanguageMeta } from "@/lib/languages";
import { resolveMeaning } from "@/lib/data";
import type { NativeLanguageCode, VocabularyWord } from "@/lib/types";

/** How many words the chart shows — two rows of ten at the widest. */
const CHART_SIZE = 20;

/**
 * The frequency chart.
 *
 * A map of the language rather than a lesson: the first twenty entries of the
 * corpus list, in corpus order, so the learner can see the shape of what they
 * are walking into. It is the same twenty the app will actually teach first,
 * because `getVocabulary` is rank-ordered — which is the point. A chart built
 * from a hand-picked set would show a language that does not exist, and one
 * built from the *glossed* set in any other order would drift towards whatever
 * part of speech happens to be easiest to write down (in this dataset, verbs).
 *
 * The tile shows the word and its romanization, mirroring a kana chart: the
 * glyph is what you are learning to recognise, the romanization is the crutch
 * underneath it. The meaning is one hover away rather than printed, so the
 * chart stays scannable.
 */
export function WordChart({
  words,
  language,
  nativeLanguage,
  className,
}: {
  words: VocabularyWord[];
  language: LanguageMeta;
  nativeLanguage: NativeLanguageCode;
  className?: string;
}) {
  const shown = useMemo(() => words.slice(0, CHART_SIZE), [words]);
  if (shown.length === 0) return null;

  const rtl = language.code === "ar";

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={cn("surface-card grain relative isolate overflow-hidden pad-card", className)}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
        The first {shown.length}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        In corpus order — the {shown.length} words you will meet before any others.
      </p>

      {/* Four to a row on a phone, five on a tablet, ten across a desktop card.
          The tiles want to stay roughly square-ish and readable, so the count
          per row tracks the width rather than letting them stretch. */}
      <ol className="relative z-10 mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        {shown.map((w) => (
          <li
            key={w.id}
            title={`${resolveMeaning(w, nativeLanguage)} · No. ${w.frequencyRank}`}
            data-chart-rank={w.frequencyRank}
            data-chart-pos={w.partOfSpeech ?? "none"}
            data-chart-word={w.word}
            className="relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-chip border border-line bg-paper/60 px-1 py-2"
          >
            <span
              lang={language.code}
              dir={rtl ? "rtl" : "ltr"}
              className="max-w-full break-words text-center text-[17px] font-semibold leading-tight text-ink"
            >
              {w.word}
            </span>
            {(w.romanized || (w.reading && w.reading !== w.word)) && (
              <span className="max-w-full truncate font-serif text-[10px] italic leading-tight text-faint">
                {w.romanized ?? w.reading}
              </span>
            )}
            <span className="sr-only">{resolveMeaning(w, nativeLanguage)}</span>
            {/* The rank, as a corner annotation — the reference chart's marks.
                Small enough that the glyph stays the subject of the tile. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-1 top-0.5 text-[9px] font-medium tabular-nums text-faint"
            >
              {w.frequencyRank}
            </span>
          </li>
        ))}
      </ol>

      <p className="relative z-10 mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-faint">
        Ranked by how often each word occurs in {language.name}&rsquo;s corpus list.
      </p>
    </motion.section>
  );
}
