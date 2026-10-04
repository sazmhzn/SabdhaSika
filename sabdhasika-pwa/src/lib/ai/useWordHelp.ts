"use client";

import { useCallback, useRef, useState } from "react";
import type { WordHelpResponse } from "@/lib/ai/helpProvider";
import { track } from "@/lib/metrics";
import type { LanguageCode, NativeLanguageCode, VocabularyWord } from "@/lib/types";

export interface WordHelpState {
  /** True only while a request is in flight. */
  loading: boolean;
  help: WordHelpResponse | null;
  /** Set when the request failed. The static example is still shown. */
  failed: boolean;
}

const IDLE: WordHelpState = { loading: false, help: null, failed: false };

/**
 * Ask for help on one word.
 *
 * Every failure path is deliberate, because help is an enhancement and the card
 * is never *waiting* on it:
 *
 *  · Offline or unconfigured -> resolves to nothing, `failed` stays false. The
 *    learner cannot tell the difference, which is the point.
 *  · A server error -> `failed` true, so the UI can say so quietly rather than
 *    showing a spinner forever.
 *
 * Requests are aborted when a newer one starts, so mashing "Stuck?" on three
 * cards cannot leave an answer for the wrong word on screen.
 */
export function useWordHelp() {
  const [state, setState] = useState<WordHelpState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(
    async (
      word: VocabularyWord,
      meaning: string,
      languages: {
        targetLanguage: LanguageCode;
        targetLanguageName: string;
        nativeLanguage: NativeLanguageCode;
        nativeLanguageName: string;
      },
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ loading: true, help: null, failed: false });
      track("word_viewed", { source: "stuck" });

      try {
        const res = await fetch("/api/word-help", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            wordId: word.id,
            word: word.word,
            meaning,
            partOfSpeech: word.partOfSpeech,
            exampleNative: word.example?.native,
            exampleTranslation: word.example?.translation,
            ...languages,
          }),
        });

        if (!res.ok) {
          // 503 means the deployment has no key: not an error worth showing.
          const unavailable = res.status === 503;
          if (!unavailable) setState({ loading: false, help: null, failed: true });
          else setState(IDLE);
          return;
        }

        const help = (await res.json()) as WordHelpResponse;
        if (controller.signal.aborted) return;
        setState({ loading: false, help, failed: false });
      } catch {
        if (controller.signal.aborted) return;
        // Offline, or the app is closing. Same as unconfigured: no complaint.
        setState(IDLE);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  return { ...state, ask, reset };
}