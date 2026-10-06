"use client";

import { motion } from "framer-motion";
import { Delete, Eraser, Volume2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/nav/AppShell";
import { SignCamera } from "@/components/sign/SignCamera";
import { Button } from "@/components/ui/Button";
import { sfx, speak, stopSpeaking } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { loadSignModel, type SignModel } from "@/lib/sign/model";
import { TRAINABLE_LETTERS } from "@/lib/sign/samples";
import { useSignRecognizer } from "@/lib/sign/useSignRecognizer";

/** How long a letter must be held before it is added to the spelled text. */
const DWELL_MS = 900;
const BUFFER_LIMIT = 40;

/**
 * Fingerspelling, read back.
 *
 * Live recognition on top, a running transcription below: hold a letter long
 * enough and it commits, so the screen works as a slow, deliberate
 * fingerspelling-to-text converter rather than only a letter readout. Speak
 * reads the result aloud with the browser's own voice.
 */
export default function SignPage() {
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
  const { letter, confidence, status, hasHand } = recognition;

  /* ── dwell-to-commit ──────────────────────────────────────────────── */
  const [text, setText] = useState("");
  const committedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!letter) {
      committedRef.current = null;
      return;
    }
    if (committedRef.current === letter) return;
    const held = letter;
    const timer = setTimeout(() => {
      committedRef.current = held;
      setText((prev) => (prev + held).slice(-BUFFER_LIMIT));
      sfx.tap();
    }, DWELL_MS);
    return () => clearTimeout(timer);
  }, [letter]);

  const backspace = useCallback(() => {
    setText((prev) => prev.slice(0, -1));
    sfx.tap();
  }, []);

  const clear = useCallback(() => {
    setText("");
    committedRef.current = null;
    sfx.tap();
  }, []);

  const readAloud = useCallback(() => {
    if (!text) return;
    speak({ text, bcp47: "en-US" });
  }, [text]);

  useEffect(() => stopSpeaking, []);

  return (
    <div className="pt-5 lg:pt-0">
      <PageHeader
        eyebrow="American Sign Language"
        title="Fingerspelling"
        trailing={
          <span className="flex items-center gap-4">
            <Link href="/sign/chat" className="press text-[12.5px] font-semibold text-muted hover:text-ink">
              Conversation
            </Link>
            <Link href="/sign/practice" className="press text-[12.5px] font-semibold text-muted hover:text-ink">
              Practice
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
            Record a few samples of each letter in front of your camera, export them, then run{" "}
            <code className="rounded bg-paper px-1.5 py-0.5 text-[12px]">npm run sign:train</code>. The
            readout below lights up as soon as a model is present.
          </p>
          <div className="mt-4">
            <Link href="/sign/record">
              <Button size="sm">Record samples</Button>
            </Link>
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
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
              <div className="min-w-[92px] rounded-panel bg-black/45 px-6 py-2 text-center backdrop-blur">
                <div className="text-[52px] font-extrabold leading-none tracking-[-0.03em] text-white">
                  {letter ?? "–"}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    animate={{ width: `${Math.round(confidence * 100)}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  {Math.round(confidence * 100)}%
                </div>
              </div>
            </div>
          }
        />

        <div className="mt-3 flex flex-col gap-3 lg:mt-0">
          {/* spelled text */}
          <section className="rounded-panel border border-line bg-paper pad-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                Spelled
              </p>
              <span className="text-[11px] text-faint">hold a letter to add it</span>
            </div>
            <p
              aria-live="polite"
              className="mt-3 min-h-[52px] break-words font-mono text-[26px] font-semibold leading-tight tracking-[0.06em] text-ink"
            >
              {text || <span className="text-faint">—</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={backspace}
                disabled={!text}
                className="press inline-flex h-10 items-center gap-2 rounded-chip border border-line bg-surface px-3 text-[13px] font-semibold text-ink-soft disabled:opacity-40"
              >
                <Delete className="size-4" strokeWidth={2.2} />
                Backspace
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={!text}
                className="press inline-flex h-10 items-center gap-2 rounded-chip border border-line bg-surface px-3 text-[13px] font-semibold text-ink-soft disabled:opacity-40"
              >
                <Eraser className="size-4" strokeWidth={2.2} />
                Clear
              </button>
              <Button onClick={readAloud} disabled={!text} variant="secondary" className="ml-auto">
                <Volume2 className="size-4" strokeWidth={2.2} />
                Speak
              </Button>
            </div>
          </section>

          {/* alphabet legend — letters only, no diagrams */}
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
                    ch === letter
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
                  title="This letter is drawn in the air — motion, not a static shape. Not recognised yet."
                  className="grid size-7 place-items-center rounded-md border border-dashed border-line text-[12.5px] font-semibold text-faint"
                >
                  {ch}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
              J and Z are traced in the air, so they need motion rather than a held shape. They are not
              part of the static set yet.
            </p>
          </section>

          <p className="flex items-center gap-2 px-1 text-[11px] text-faint">
            <span className="size-1.5 rounded-full bg-good" />
            Processed on your device. No video leaves it.
          </p>
        </div>
      </div>
    </div>
  );
}
