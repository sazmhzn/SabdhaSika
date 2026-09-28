/**
 * Pronunciation.
 *
 * `pronunciation` on a word is *not* the romanization — it is a spoken form
 * hint. We speak the native word with the language's BCP-47 voice, and expose
 * the raw hint for display (IPA, tonal pinyin, …).
 *
 * Everything here degrades silently: no voices, no audio, no error.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices;
}

export function primeVoices(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = () => refreshVoices();
}

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Best available voice for a BCP-47 tag, preferring exact region matches. */
export function pickVoice(bcp47: string): SpeechSynthesisVoice | undefined {
  const voices = refreshVoices();
  if (!voices.length) return undefined;
  const [lang] = bcp47.split("-");
  return (
    voices.find((v) => v.lang.replace("_", "-").toLowerCase() === bcp47.toLowerCase()) ??
    voices.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lang.toLowerCase()))
  );
}

export interface SpeakOptions {
  text: string;
  bcp47: string;
  /** 0.5–1.0; slightly slower is friendlier for learners. */
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

export function speak({ text, bcp47, rate = 0.86, onStart, onEnd }: SpeakOptions): boolean {
  if (!speechAvailable()) {
    onEnd?.();
    return false;
  }
  try {
    // Cancel anything in flight so rapid taps don't queue up a stutter.
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = bcp47;
    utter.rate = rate;
    utter.pitch = 1;
    const voice = pickVoice(bcp47);
    if (voice) utter.voice = voice;
    utter.onstart = () => onStart?.();
    utter.onend = () => onEnd?.();
    utter.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    onEnd?.();
    return false;
  }
}

export function stopSpeaking(): void {
  if (!speechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Interface sounds.
 *
 * Deliberately synthesised rather than shipped as audio files: a few
 * hundred bytes of WebAudio instead of a megabyte of mp3s, and it works
 * offline with zero cache strategy. Kept very quiet and very short.
 * ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;

/**
 * Master switch for interface sounds. Kept as module state rather than a
 * prop because sounds are fired from a dozen small components and threading a
 * boolean through all of them would be noise. The store syncs it on change.
 */
let soundEnabled = true;

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function unlockAudio(): void {
  const c = audioContext();
  if (c && c.state === "suspended") void c.resume();
}

interface Tone {
  freq: number;
  /** seconds */
  at: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
}

function playTones(tones: Tone[], volume = 0.05): void {
  if (!soundEnabled) return;
  const c = audioContext();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const now = c.currentTime;
  for (const t of tones) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, now + t.at);
    const peak = (t.gain ?? 1) * volume;
    gain.gain.setValueAtTime(0.0001, now + t.at);
    gain.gain.exponentialRampToValueAtTime(peak, now + t.at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.at + t.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(now + t.at);
    osc.stop(now + t.at + t.dur + 0.02);
  }
}

export const sfx = {
  /** Card reveal: a soft upward "open". */
  reveal: () => playTones([{ freq: 420, at: 0, dur: 0.09 }, { freq: 630, at: 0.05, dur: 0.12 }], 0.035),
  /** Correct: a two-note major lift. */
  correct: () =>
    playTones(
      [
        { freq: 587.33, at: 0, dur: 0.1 },
        { freq: 880, at: 0.08, dur: 0.16 },
      ],
      0.05,
    ),
  /** Incorrect: a single low, warm note. Never a buzzer. */
  incorrect: () => playTones([{ freq: 233.08, at: 0, dur: 0.16, type: "triangle" }], 0.045),
  /** Rating taps. */
  tap: () => playTones([{ freq: 700, at: 0, dur: 0.045 }], 0.025),
  /** Session complete: a small arpeggio. */
  complete: () =>
    playTones(
      [
        { freq: 523.25, at: 0, dur: 0.14 },
        { freq: 659.25, at: 0.1, dur: 0.14 },
        { freq: 783.99, at: 0.2, dur: 0.18 },
        { freq: 1046.5, at: 0.32, dur: 0.3 },
      ],
      0.055,
    ),
  /** Milestone: bigger, but still gentle. */
  milestone: () =>
    playTones(
      [
        { freq: 392, at: 0, dur: 0.16 },
        { freq: 523.25, at: 0.11, dur: 0.16 },
        { freq: 659.25, at: 0.22, dur: 0.16 },
        { freq: 880, at: 0.33, dur: 0.42 },
      ],
      0.06,
    ),
};
