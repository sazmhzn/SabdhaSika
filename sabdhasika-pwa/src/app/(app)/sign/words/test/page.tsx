"use client";

import { ArrowLeft, CircleDot, Download, Eraser, RefreshCw, Square, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/nav/AppShell";
import { ReferenceClip } from "@/components/sign/ReferenceClip";
import { SignCamera } from "@/components/sign/SignCamera";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { scoreAttempt, type AttemptScore } from "@/lib/sign/word-dtw";
import {
  classifyWord,
  loadWordModel,
  type WordModel,
  type WordPrediction,
} from "@/lib/sign/word-model";
import { PILOT_WORDS, clipFor } from "@/lib/sign/word-clips";
import {
  addWordTemplate,
  clearAllWordTemplates,
  clearWordTemplate,
  countByWord,
  exportWordTemplates,
  importWordTemplatesJson,
  loadWordTemplates,
  type WordTemplateStore,
} from "@/lib/sign/word-templates";
import { useSignRecognizer } from "@/lib/sign/useSignRecognizer";

/** ms between captured frames while recording — mirrors /sign/record. */
const SAMPLE_INTERVAL_MS = 70;
/** Minimum frames for a usable attempt (~0.5s of hand). */
const MIN_FRAMES = 8;

type Tab = "enroll" | "test";

/**
 * Word-sign test (pilot).
 *
 * Enroll a template per word with your own camera, then get prompted with a
 * word and sign it: the attempt is DTW-scored on-device against your
 * templates, and — once `npm run words:train` has produced a model — the
 * trained LSTM offers a second opinion underneath. DTW is the verdict;
 * the neural line is advisory until its held-out accuracy earns more.
 *
 * Deliberately never touches progress, streak or sessions: a test run is a
 * practice run, and only an empty queue is Day done.
 */
export default function SignWordsTestPage() {
  const recognition = useSignRecognizer();
  const { status, hasHand } = recognition;

  const [tab, setTab] = useState<Tab>("enroll");
  const [store, setStore] = useState<WordTemplateStore>(() => loadWordTemplates());
  const [word, setWord] = useState<string>(PILOT_WORDS[0]);
  const [recording, setRecording] = useState(false);
  const [collected, setCollected] = useState(0);
  const [score, setScore] = useState<AttemptScore | null>(null);
  const [neural, setNeural] = useState<WordPrediction | null>(null);
  const [wordModel, setWordModel] = useState<WordModel | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const framesRef = useRef<number[][]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => countByWord(store), [store]);
  const enrolled = useMemo(() => Object.keys(store.templates), [store]);
  const canRecord = status === "running" && Boolean(hasHand);

  const stopAndKeep = useCallback(() => {
    setRecording(false);
    return framesRef.current;
  }, []);

  /* Capture feature frames on an interval while recording. */
  useEffect(() => {
    if (!recording) return;
    framesRef.current = [];
    setCollected(0);
    setScore(null);
    setNeural(null);
    const id = window.setInterval(() => {
      const features = recognition.latest.current.features;
      if (features) {
        framesRef.current.push(features.values);
        setCollected(framesRef.current.length);
      }
    }, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [recognition.latest, recording]);

  const enrollStop = useCallback(() => {
    const frames = stopAndKeep();
    if (frames.length >= MIN_FRAMES) setStore((prev) => addWordTemplate(prev, slugOf(word), frames));
  }, [stopAndKeep, word]);

  /* The trained LSTM, when `npm run words:train` has produced one. Absent
     means DTW-only scoring — the template path needs no model file. */
  useEffect(() => {
    let alive = true;
    loadWordModel()
      .then((m) => {
        if (alive) setWordModel(m);
      })
      .catch(() => {
        /* no neural model trained yet — DTW carries the test */
      });
    return () => {
      alive = false;
    };
  }, []);

  const testStop = useCallback(() => {
    const frames = stopAndKeep();
    if (frames.length < MIN_FRAMES) {
      setScore(null);
      setNeural(null);
      return;
    }
    setScore(scoreAttempt(store.templates, frames));
    setNeural(wordModel ? classifyWord(wordModel, frames) : null);
  }, [stopAndKeep, store.templates, wordModel]);

  const toggleRecording = useCallback(() => {
    if (recording) (tab === "enroll" ? enrollStop : testStop)();
    else setRecording(true);
  }, [enrollStop, recording, tab, testStop]);

  const newPrompt = useCallback(
    (exclude?: string) => {
      const pool = enrolled.filter((s) => s !== exclude);
      const source = pool.length > 0 ? pool : enrolled;
      if (source.length === 0) {
        setPrompt(null);
        return;
      }
      setPrompt(source[Math.floor(Math.random() * source.length)]);
      setScore(null);
    },
    [enrolled],
  );

  useEffect(() => {
    if (tab === "test" && prompt === null && enrolled.length > 0) newPrompt();
    if (tab === "test" && prompt && !enrolled.includes(prompt)) newPrompt(prompt);
  }, [tab, prompt, enrolled, newPrompt]);

  const onImportFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      setStore((prev) => {
        const { store: next, imported: n } = importWordTemplatesJson(prev, text);
        setImported(n > 0 ? `Imported templates for ${n} word${n === 1 ? "" : "s"}.` : "No usable templates in that file.");
        return next;
      });
    },
    [],
  );

  const promptGloss = prompt ? glossOf(prompt) : null;
  const correct = score !== null && prompt !== null && score.best === prompt && score.pass;

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader
        eyebrow="Word signs"
        title="Test"
        trailing={
          <Link
            href="/sign/words"
            className="press inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2.4} />
            Reference clips
          </Link>
        }
      />

      {/* tabs */}
      <div className="mb-3 flex gap-1.5">
        {(["enroll", "test"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setScore(null);
              setRecording(false);
            }}
            className={cn(
              "press rounded-chip border px-4 py-2 text-[13px] font-semibold capitalize",
              tab === t ? "border-transparent bg-ink text-paper" : "border-line bg-surface text-ink-soft",
            )}
          >
            {t === "enroll" ? "Enroll" : "Test me"}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
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
              tab === "test" && promptGloss ? (
                <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
                  <div className="rounded-panel bg-black/45 px-6 py-2 text-center backdrop-blur">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                      Sign this
                    </div>
                    <div className="text-[40px] font-extrabold capitalize leading-tight text-white">
                      {promptGloss}
                    </div>
                  </div>
                </div>
              ) : undefined
            }
          />
          <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted">
            {tab === "enroll"
              ? "Hold the full sign for a second, then record it. One or two takes per word is enough to start."
              : "Watch the clip, then sign it back. Scoring runs on this device — nothing is uploaded."}
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:mt-0">
          {tab === "enroll" ? (
            <>
              <section className="rounded-panel border border-line bg-paper pad-panel">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                  Choose a word
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {PILOT_WORDS.map((w) => {
                    const n = counts[slugOf(w)] ?? 0;
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWord(w)}
                        title={`${n} template${n === 1 ? "" : "s"}`}
                        className={cn(
                          "press rounded-chip border px-3 py-2 text-[13px] font-semibold capitalize",
                          w === word
                            ? "border-transparent bg-ink text-paper"
                            : n > 0
                              ? "border-line bg-good-soft text-good"
                              : "border-line bg-surface text-ink-soft",
                        )}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-panel border border-line bg-paper pad-panel">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-ink">
                    {counts[slugOf(word)] ?? 0}
                    <span className="text-faint"> template{(counts[slugOf(word)] ?? 0) === 1 ? "" : "s"} of “{word}”</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setStore((prev) => clearWordTemplate(prev, slugOf(word)))}
                    disabled={(counts[slugOf(word)] ?? 0) === 0}
                    className="press text-[12px] font-semibold text-faint hover:text-ink disabled:opacity-40"
                  >
                    Clear word
                  </button>
                </div>
                <div className="mt-4">
                  <Button onClick={toggleRecording} disabled={!canRecord} size="lg" full>
                    {recording ? (
                      <>
                        <Square className="size-4" strokeWidth={2.4} />
                        Stop · {collected}
                      </>
                    ) : (
                      <>
                        <CircleDot className="size-4" strokeWidth={2.4} />
                        Record “{word}”
                      </>
                    )}
                  </Button>
                </div>
                {!canRecord && status === "running" && (
                  <p className="mt-2 text-center text-[11.5px] text-faint">
                    A hand must be visible before recording.
                  </p>
                )}
              </section>

              <section className="rounded-panel border border-line bg-paper pad-panel">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Dataset</p>
                <p className="mt-2 text-[13px] text-muted">
                  <span className="font-semibold text-ink tabular-nums">{enrolled.length}</span> of {PILOT_WORDS.length}{" "}
                  words enrolled.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => exportWordTemplates(store)} disabled={enrolled.length === 0} size="sm">
                    <Download className="size-4" strokeWidth={2.2} />
                    Export JSON
                  </Button>
                  <Button onClick={() => fileRef.current?.click()} variant="secondary" size="sm">
                    <Upload className="size-4" strokeWidth={2.2} />
                    Import JSON
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStore(clearAllWordTemplates())}
                    disabled={enrolled.length === 0}
                    className="press inline-flex h-10 items-center gap-2 rounded-chip border border-line bg-surface px-3 text-[13px] font-semibold text-ink-soft disabled:opacity-40"
                  >
                    <Eraser className="size-4" strokeWidth={2.2} />
                    Clear all
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onImportFile(f);
                    e.target.value = "";
                  }}
                />
                {imported && <p className="mt-3 text-[12px] text-muted">{imported}</p>}
                <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
                  Imports <code className="rounded bg-surface px-1 py-0.5 text-[11px]">extract.py</code> output too —
                  SL-derived templates drop in without re-enrolling.
                </p>
              </section>
            </>
          ) : enrolled.length === 0 ? (
            <section className="rounded-panel border border-line bg-paper pad-panel">
              <p className="text-[13.5px] font-semibold text-ink">No templates yet</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                Enroll at least one word first — the test scores your signing against your own templates.
              </p>
              <div className="mt-4">
                <Button size="sm" onClick={() => setTab("enroll")}>
                  Go to enroll
                </Button>
              </div>
            </section>
          ) : (
            <>
              {promptGloss && <ReferenceClip clip={clipFor(promptGloss)} />}
              <section className="rounded-panel border border-line bg-paper pad-panel">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold capitalize text-ink">Sign “{promptGloss}”</p>
                  <button
                    type="button"
                    onClick={() => newPrompt(prompt ?? undefined)}
                    className="press inline-flex items-center gap-1.5 text-[12px] font-semibold text-faint hover:text-ink"
                  >
                    <RefreshCw className="size-3.5" strokeWidth={2.2} />
                    New word
                  </button>
                </div>
                <div className="mt-4">
                  <Button onClick={toggleRecording} disabled={!canRecord} size="lg" full>
                    {recording ? (
                      <>
                        <Square className="size-4" strokeWidth={2.4} />
                        Stop · {collected}
                      </>
                    ) : (
                      <>
                        <CircleDot className="size-4" strokeWidth={2.4} />
                        Sign it
                      </>
                    )}
                  </Button>
                </div>
                {!canRecord && status === "running" && (
                  <p className="mt-2 text-center text-[11.5px] text-faint">
                    A hand must be visible before recording.
                  </p>
                )}
                {score && (
                  <div
                    className={cn(
                      "mt-4 rounded-chip border px-4 py-3",
                      correct ? "border-good/40 bg-good-soft" : "border-line bg-surface",
                    )}
                  >
                    <p className="text-[14px] font-semibold text-ink">
                      {correct ? "Correct — nice signing." : `Heard “${glossOf(score.best)}” (${Math.round(score.confidence * 100)}%).`}
                    </p>
                    {!correct && score.pass && (
                      <p className="mt-1 text-[12.5px] text-muted">
                        Close, but not “{promptGloss}” — check the clip and try again.
                      </p>
                    )}
                    {!score.pass && (
                      <p className="mt-1 text-[12.5px] text-muted">
                        No confident match — hold the full sign steady through the recording.
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {score.results.slice(0, 5).map((r) => (
                        <span
                          key={r.gloss}
                          className="rounded bg-paper px-2 py-1 font-mono text-[11px] capitalize text-muted"
                        >
                          {glossOf(r.gloss)} {r.distance.toFixed(1)}
                        </span>
                      ))}
                    </div>
                    {neural && (
                      <p className="mt-2 text-[12px] text-muted">
                        Neural model:{" "}
                        {neural.word ? (
                          <>
                            heard “<span className="font-semibold capitalize">{glossOf(neural.word)}</span>” (
                            {Math.round(neural.confidence * 100)}%)
                          </>
                        ) : (
                          <>no confident word ({Math.round(neural.confidence * 100)}%)</>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function slugOf(gloss: string): string {
  return gloss.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function glossOf(slug: string): string {
  return slug.replace(/-/g, " ");
}
