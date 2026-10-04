"use client";

import { ArrowLeft, CircleDot, Download, Eraser, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/nav/AppShell";
import { SignCamera } from "@/components/sign/SignCamera";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  addSamples,
  clearAll,
  clearLabel,
  countByLabel,
  exportSamples,
  loadSamples,
  TRAINABLE_LETTERS,
  type SampleSet,
} from "@/lib/sign/samples";
import { useSignRecognizer } from "@/lib/sign/useSignRecognizer";

/** Samples to aim for per letter. More for the letters that look alike. */
const TARGET = 50;
/** How often a frame is captured while recording, in ms. */
const SAMPLE_INTERVAL_MS = 70;

/**
 * Recording studio for the recogniser.
 *
 * Deliberately plain: pick a letter, hold the sign, record a couple of seconds,
 * repeat. The value of the whole feature rides on this data being varied —
 * different distances, angles and hand sizes — so the copy says so out loud
 * rather than implying a single perfect pose is enough.
 *
 * Nothing is uploaded. The export is a file you hand to the trainer.
 */
export default function SignRecordPage() {
  const recognition = useSignRecognizer();
  const { status, hasHand } = recognition;

  const [set, setSet] = useState<SampleSet>(() => loadSamples());
  const [current, setCurrent] = useState<string>("A");
  const [recording, setRecording] = useState(false);
  const [collected, setCollected] = useState(0);
  const framesRef = useRef<number[][]>([]);

  const counts = useMemo(() => countByLabel(set), [set]);
  const total = set.samples.length;
  const done = TRAINABLE_LETTERS.filter((ch) => (counts[ch] ?? 0) >= TARGET).length;

  /* Capture a frame every `SAMPLE_INTERVAL_MS` while recording. Reads the
     hook's ref directly, so recording never causes a re-render per frame. */
  useEffect(() => {
    if (!recording) return;
    framesRef.current = [];
    setCollected(0);
    const id = window.setInterval(() => {
      const features = recognition.latest.current.features;
      if (features) {
        framesRef.current.push(features.values);
        setCollected(framesRef.current.length);
      }
    }, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [recognition.latest, recording]);

  const stopRecording = useCallback(() => {
    setRecording(false);
    const frames = framesRef.current;
    if (frames.length > 0) setSet((prev) => addSamples(prev, current, frames));
  }, [current]);

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else setRecording(true);
  }, [recording, stopRecording]);

  const canRecord = status === "running" && Boolean(hasHand);

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader
        eyebrow="Train the recogniser"
        title="Record samples"
        trailing={
          <Link
            href="/sign"
            className="press inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2.4} />
            Back
          </Link>
        }
      />

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
              <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                <div className="rounded-panel bg-black/45 px-5 py-2 text-center backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                    Signing
                  </div>
                  <div className="text-[40px] font-extrabold leading-none text-white">{current}</div>
                </div>
              </div>
            }
          />
          <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted">
            Vary the distance and angle between takes, and hold the shape for a second before you start
            recording. Aim for about {TARGET} samples per letter.
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:mt-0">
          {/* letter picker */}
          <section className="rounded-panel border border-line bg-paper pad-panel">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              Choose a letter
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TRAINABLE_LETTERS.map((ch) => {
                const n = counts[ch] ?? 0;
                const complete = n >= TARGET;
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setCurrent(ch)}
                    title={`${n} samples`}
                    className={cn(
                      "press grid size-8 place-items-center rounded-md border text-[13px] font-semibold tabular-nums",
                      ch === current
                        ? "border-transparent bg-ink text-paper"
                        : complete
                          ? "border-line bg-good-soft text-good"
                          : n > 0
                            ? "border-line bg-surface text-ink"
                            : "border-line bg-surface text-faint",
                    )}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
          </section>

          {/* recorder */}
          <section className="rounded-panel border border-line bg-paper pad-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-ink">
                {counts[current] ?? 0}
                <span className="text-faint"> / {TARGET}</span> samples of “{current}”
              </p>
              <button
                type="button"
                onClick={() => setSet((prev) => clearLabel(prev, current))}
                disabled={(counts[current] ?? 0) === 0}
                className="press text-[12px] font-semibold text-faint hover:text-ink disabled:opacity-40"
              >
                Clear letter
              </button>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-200"
                style={{ width: `${Math.min(100, ((counts[current] ?? 0) / TARGET) * 100)}%` }}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={toggleRecording}
                disabled={!canRecord}
                variant={recording ? "secondary" : "primary"}
                size="lg"
                full
              >
                {recording ? (
                  <>
                    <Square className="size-4" strokeWidth={2.4} />
                    Stop · {collected}
                  </>
                ) : (
                  <>
                    <CircleDot className="size-4" strokeWidth={2.4} />
                    Record “{current}”
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

          {/* export */}
          <section className="rounded-panel border border-line bg-paper pad-panel">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Dataset</p>
            <p className="mt-2 text-[13px] text-muted">
              <span className="font-semibold text-ink tabular-nums">{total}</span> samples across{" "}
              <span className="font-semibold text-ink tabular-nums">{done}</span>/
              {TRAINABLE_LETTERS.length} letters complete.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => exportSamples(set)} disabled={total === 0} size="sm">
                <Download className="size-4" strokeWidth={2.2} />
                Export JSON
              </Button>
              <button
                type="button"
                onClick={() => setSet(clearAll())}
                disabled={total === 0}
                className="press inline-flex h-10 items-center gap-2 rounded-chip border border-line bg-surface px-3 text-[13px] font-semibold text-ink-soft disabled:opacity-40"
              >
                <Eraser className="size-4" strokeWidth={2.2} />
                Clear all
              </button>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
              Save the exported file as{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-[11px]">
                scripts/data/sign-samples.json
              </code>{" "}
              and run{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-[11px]">npm run sign:train</code>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
