/**
 * Speech input — the learner says the word instead of typing it.
 *
 * Same contract as `audio.ts`: everything degrades silently and nothing here is
 * allowed to throw into a render. `speechInputAvailable()` gates the *mode*, so
 * the session never offers an interaction this device cannot perform.
 *
 * Two honest limitations, both handled rather than hidden:
 *  · Recognition is browser-supplied and, on most devices, cloud-backed. A word
 *    spoken here may leave the device. The pronunciation *hint* never does.
 *  · Recognition quality for tonal and non-Latin scripts is uneven. So a result
 *    is scored against the same `checkTypedAnswer` rules as typing, and a
 *    near-miss is reported as such rather than being silently accepted or
 *    rejected.
 */

/* The vendor prefixes are real and still needed; Safari has shipped both. */
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

interface SpeechRecognitionEventLike {
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >;
  resultIndex: number;
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Whether speech input can even be offered.
 *
 * Deliberately only checks that the constructor exists. Permission and network
 * are unknowable up front and both surface at runtime, so `startListening`
 * reports them through its callbacks rather than gating the UI.
 */
export function speechInputAvailable(): boolean {
  return recognitionCtor() !== null;
}

export interface ListenCallbacks {
  /** Interim text, so the learner can see they are being heard. */
  onPartial?: (text: string) => void;
  /** The best final transcript. */
  onFinal: (transcript: string) => void;
  /** The device refused or failed. Never throws. */
  onError?: (reason: SpeechInputError) => void;
}

export type SpeechInputError =
  | "unsupported"
  | "denied"
  | "no-speech"
  | "network"
  | "failed";

export interface ListeningSession {
  stop: () => void;
}

const ERROR_MAP: Record<string, SpeechInputError> = {
  "not-allowed": "denied",
  "service-not-allowed": "denied",
  "no-speech": "no-speech",
  network: "network",
  aborted: "failed",
};

/**
 * Listen once and report the best final transcript.
 *
 * `interimResults` is on so the learner sees their own words coming back —
 * without that, a two-second utterance gives no feedback at all and the
 * interaction feels broken even when it works.
 *
 * Returns `null` when the API is absent, which is the caller's signal to fall
 * back to another mode rather than to show an error.
 */
export function startListening(
  bcp47: string,
  callbacks: ListenCallbacks,
): ListeningSession | null {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    callbacks.onError?.("unsupported");
    return null;
  }

  let rec: SpeechRecognitionLike;
  try {
    rec = new Ctor();
  } catch {
    callbacks.onError?.("unsupported");
    return null;
  }

  rec.lang = bcp47;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 5;

  let settled = false;
  let best = "";

  const finish = () => {
    if (settled) return;
    settled = true;
    if (best.trim()) callbacks.onFinal(best.trim());
    else callbacks.onError?.("no-speech");
  };

  rec.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const alternative = result[0]?.transcript ?? "";
      if (!alternative) continue;
      best = alternative;
      if (result.isFinal) {
        best = alternative;
        return;
      }
      callbacks.onPartial?.(alternative);
    }
  };

  rec.onerror = (event) => {
    if (settled) return;
    const mapped = ERROR_MAP[event.error ?? ""] ?? "failed";
    // A denial is not a failed attempt, so it must not be reported as one —
    // the caller falls back silently rather than telling the learner they were
    // wrong when the microphone was simply off. `settled` also stops the
    // `onend` that follows from reporting a second, different failure.
    settled = true;
    callbacks.onError?.(mapped);
  };

  rec.onend = () => finish();
  rec.onstart = () => {
    /* nothing to do; the caller's own "listening" flag drives the UI */
  };

  try {
    rec.start();
  } catch {
    callbacks.onError?.("failed");
    return null;
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}