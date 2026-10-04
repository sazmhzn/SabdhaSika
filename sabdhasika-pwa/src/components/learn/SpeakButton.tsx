"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import {
  speechInputAvailable,
  startListening,
  type ListeningSession,
  type SpeechInputError,
} from "@/lib/speech-input";

export interface SpeakButtonProps {
  bcp47: string;
  /** Interim transcript, shown so the learner can see they are being heard. */
  partial: string;
  listening: boolean;
  disabled?: boolean;
  hapticsEnabled?: boolean;
  onStart: () => ListeningSession | null;
  onPartial: (text: string) => void;
  onFinal: (transcript: string) => void;
  /** A denial or a dead microphone — the caller falls back quietly. */
  onUnavailable: (reason: SpeechInputError) => void;
  className?: string;
}

/**
 * Speaking a word.
 *
 * The microphone is a *secondary* route to the same answer the learner could
 * have typed, so every failure here is quiet. A denied permission, a missing
 * recogniser, a silent room — none of them should interrupt the session or make
 * the learner feel they did something wrong. The caller decides what to fall
 * back to; this component only reports.
 *
 * Listening is explicit. Nothing starts on mount: a microphone that opens by
 * itself is a surprise, and on a shared or public device it is an intrusion.
 */
export function SpeakButton({
  bcp47,
  partial,
  listening,
  disabled = false,
  hapticsEnabled = true,
  onStart,
  onPartial,
  onFinal,
  onUnavailable,
  className,
}: SpeakButtonProps) {
  const reduce = useReducedMotion();
  const [unsupported, setUnsupported] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setUnsupported(!speechInputAvailable());
    return () => {
      mounted.current = false;
    };
  }, []);

  const press = useCallback(() => {
    haptics.tick(hapticsEnabled);
    sfx.tap();
    const session = onStart();
    if (!session) onUnavailable("unsupported");
    return session;
  }, [hapticsEnabled, onStart, onUnavailable]);

  if (unsupported) {
    // Never render a control that cannot work.
    return (
      <p className={cn("text-center text-[12px] text-faint", className)}>
        Speech input isn&rsquo;t available on this device.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative inline-grid place-items-center">
        {listening && !reduce && (
          <span className="absolute size-full rounded-full border border-accent/40 animate-ring" />
        )}
        <motion.button
          type="button"
          onClick={press}
          disabled={disabled || listening}
          aria-label={listening ? "Listening — tap to stop" : "Tap to say the word"}
          className={cn(
            "press relative grid size-14 place-items-center rounded-full border transition-colors",
            listening
              ? "border-accent bg-accent text-paper"
              : "border-line bg-paper text-ink hover:border-line-strong",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          <motion.span
            animate={listening && !reduce ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 1.1, repeat: listening ? Infinity : 0, ease: "easeInOut" }}
            className="grid place-items-center"
          >
            {listening ? (
              <MicOff className="size-5.5" strokeWidth={2.1} />
            ) : (
              <Mic className="size-5.5" strokeWidth={2.1} />
            )}
          </motion.span>
        </motion.button>
      </div>

      {/* `role="status"` so the transcript is announced without stealing focus
          from the button. */}
      <p
        role="status"
        aria-live="polite"
        className="min-h-[1.25rem] text-center text-[13px] font-medium text-ink-soft"
      >
        {partial ||
          (listening ? "Listening…" : "Tap, then say the word aloud.")}
      </p>
    </div>
  );
}

/**
 * Near-miss detection for a spoken answer.
 *
 * Recognition is nowhere near as reliable as typing — it drops tones, mangles
 * romanization, and returns whatever sounded closest. So a spoken answer that
 * is *not* an exact match is not automatically a failure: it is reported as a
 * near-miss, and the caller decides whether to credit it.
 *
 * A single edit distance is enough here. Anything cleverer would be fitting the
 * scorer to the recogniser's quirks, and the only thing this needs to answer is
 * "did they clearly get it, or should they be asked again".
 */
export function spokenAnswerQuality(
  transcript: string,
  accepted: string[],
): "exact" | "near" | "miss" {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s'’-]/g, "");
  const heard = norm(transcript);
  if (!heard) return "miss";

  for (const form of accepted) {
    const target = norm(form);
    if (!target) continue;
    if (heard === target) return "exact";
  }

  // Any accepted form within one edit of what was heard counts as a near-miss.
  for (const form of accepted) {
    const target = norm(form);
    if (target && withinOneEdit(heard, target)) return "near";
  }
  return "miss";
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  // Trailing characters are edits too.
  return edits + (a.length - i) + (b.length - j) <= 1;
}