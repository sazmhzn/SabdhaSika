"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sfx, speak, speechAvailable, stopSpeaking } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";

export interface PronunciationButtonProps {
  text: string;
  bcp47: string;
  /** IPA / respelling — shown beside the button, never instead of it. */
  hint?: string;
  enabled?: boolean;
  hapticsEnabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Called once playback finishes — used to chain auto-play. */
  onDone?: () => void;
}

/**
 * Pronunciation.
 *
 * Three deliberate details:
 *  1. It is a *button*, not an icon floating in text — 44px+ touch target.
 *  2. While playing, rings pulse outward. Feedback is not a spinner; it is
 *     the sound made visible.
 *  3. Rapid taps cancel-and-restart rather than queueing, so an impatient
 *     learner never hears a stutter.
 */
export function PronunciationButton({
  text,
  bcp47,
  hint,
  enabled = true,
  hapticsEnabled = true,
  size = "md",
  className,
  onDone,
}: PronunciationButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const reduce = useReducedMotion();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setUnsupported(!speechAvailable());
    return () => {
      mounted.current = false;
      stopSpeaking();
    };
  }, []);

  const play = useCallback(() => {
    if (!enabled) return;
    haptics.tick(hapticsEnabled);
    sfx.tap();
    const ok = speak({
      text,
      bcp47,
      onStart: () => mounted.current && setSpeaking(true),
      onEnd: () => {
        if (mounted.current) setSpeaking(false);
        onDone?.();
      },
    });
    if (!ok) {
      // No speech engine: acknowledge the tap anyway so the button never
      // feels dead. Brief flash, then reset.
      setSpeaking(true);
      setTimeout(() => mounted.current && setSpeaking(false), 420);
    }
  }, [bcp47, enabled, hapticsEnabled, onDone, text]);

  // Expose the play action so the session can bind the "R" key.
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<string>).detail === text) play();
    };
    window.addEventListener("sabdhasika:speak", handler as EventListener);
    return () => window.removeEventListener("sabdhasika:speak", handler as EventListener);
  }, [play, text]);

  const dim = size === "lg" ? "size-14" : size === "sm" ? "size-9" : "size-11";
  const icon = size === "lg" ? "size-5.5" : size === "sm" ? "size-3.5" : "size-4.5";

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className="relative inline-grid place-items-center">
        {speaking && !reduce && (
          <>
            <span className="absolute size-full rounded-full border border-ink/25 animate-ring" />
            <span
              className="absolute size-full rounded-full border border-ink/15 animate-ring"
              style={{ animationDelay: "0.35s" }}
            />
          </>
        )}
        <button
          type="button"
          onClick={play}
          disabled={!enabled}
          aria-label={unsupported ? "Pronunciation unavailable on this device" : `Play pronunciation of ${text}`}
          title={unsupported ? "Pronunciation unavailable on this device" : "Play pronunciation (R)"}
          className={cn(
            "press relative grid place-items-center rounded-full border",
            dim,
            speaking
              ? "border-ink bg-ink text-paper"
              : "border-line bg-paper text-ink hover:border-line-strong",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          <motion.span
            animate={speaking && !reduce ? { scale: [1, 1.14, 1] } : { scale: 1 }}
            transition={{ duration: 0.7, repeat: speaking ? Infinity : 0, ease: "easeInOut" }}
            className="grid place-items-center"
          >
            <Volume2 className={icon} strokeWidth={2.1} />
          </motion.span>
        </button>
      </span>
      {hint && (
        <span className="font-serif text-[15px] italic leading-none text-muted">/{hint}/</span>
      )}
    </span>
  );
}

/** Fire pronunciation for a given text from anywhere (keyboard shortcut). */
export function requestSpeak(text: string) {
  window.dispatchEvent(new CustomEvent("sabdhasika:speak", { detail: text }));
}
