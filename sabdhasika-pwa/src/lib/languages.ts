import { FREQUENCY_META } from "@/lib/data/frequency/manifest";
import type { LanguageCode, Modality, NativeLanguageCode } from "@/lib/types";

export interface LanguageMeta {
  code: LanguageCode;
  name: string;
  /** Endonym — shown large in the picker. */
  nativeName: string;
  flag: string;
  /**
   * BCP-47 tag used for SpeechSynthesis.
   *
   * Null for a signed language. There is no voice to speak with, and passing a
   * tag anyway would have the pronunciation button silently do nothing.
   */
  bcp47: string | null;
  modality: Modality;
  /** Does this script need a reading + romanization layer? */
  needsRomanization: boolean;
  /**
   * Entries in the shipped corpus frequency list. Derived — see LANGUAGES.
   * Always 0 for a signed language, which has no corpus.
   */
  frequencyListSize: number;
  /** One-line "why this language" for the picker. */
  blurb: string;
  /** True when the shipped seed dataset is a full demo set, not a sample. */
  richSeed: boolean;
  /** A single representative letter — the picker's tile glyph. */
  glyph: string;
  /** The glyph's reading, shown inside the tile. */
  glyphReading: string;
}

/**
 * Everything about a language except the size of its frequency list, which is
 * not authored here — it is read from the generated manifest in
 * `@/lib/data/frequency/manifest`. A hand-kept copy of that number is a number
 * that goes stale the moment the corpus list is rebuilt, and it had already
 * gone stale once (Nepali claimed 2,000 against a real list of 3,000).
 */
const LANGUAGE_SPECS: Omit<LanguageMeta, "frequencyListSize">[] = [
  {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
    bcp47: "ja-JP",
    modality: "spoken",
    needsRomanization: true,
    blurb: "Kana + kanji, pitch accent",
    richSeed: true,
    glyph: "あ",
    glyphReading: "a",
  },
  {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    flag: "🇰🇷",
    bcp47: "ko-KR",
    modality: "spoken",
    needsRomanization: true,
    blurb: "Hangul, verb-final",
    richSeed: true,
    glyph: "한",
    glyphReading: "han",
  },
  {
    code: "zh",
    name: "Chinese",
    nativeName: "中文",
    flag: "🇨🇳",
    bcp47: "zh-CN",
    modality: "spoken",
    needsRomanization: true,
    blurb: "Simplified, tonal pinyin",
    richSeed: true,
    glyph: "中",
    glyphReading: "zhōng",
  },
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
    bcp47: "es-ES",
    modality: "spoken",
    needsRomanization: false,
    blurb: "Latin script, no reading layer",
    richSeed: true,
    glyph: "ñ",
    glyphReading: "eñe",
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    bcp47: "fr-FR",
    modality: "spoken",
    needsRomanization: false,
    blurb: "Latin script, liaison",
    richSeed: true,
    glyph: "é",
    glyphReading: "e-acute",
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    bcp47: "de-DE",
    modality: "spoken",
    needsRomanization: false,
    blurb: "Latin script, compound nouns",
    richSeed: true,
    glyph: "ß",
    glyphReading: "eszett",
  },
  {
    code: "ne",
    name: "Nepali",
    nativeName: "नेपाली",
    flag: "🇳🇵",
    bcp47: "ne-NP",
    modality: "spoken",
    needsRomanization: true,
    blurb: "Devanagari, SOV order",
    richSeed: true,
    glyph: "श",
    glyphReading: "śa",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    flag: "🇮🇳",
    bcp47: "hi-IN",
    modality: "spoken",
    needsRomanization: true,
    blurb: "Devanagari, gendered verbs",
    richSeed: true,
    glyph: "ह",
    glyphReading: "ha",
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    bcp47: "ar-SA",
    modality: "spoken",
    needsRomanization: true,
    blurb: "RTL script, root system",
    richSeed: true,
    glyph: "ع",
    glyphReading: "'ayn",
  },
  {
    code: "ru",
    name: "Russian",
    nativeName: "Русский",
    flag: "🇷🇺",
    bcp47: "ru-RU",
    modality: "spoken",
    needsRomanization: true,
    blurb: "Cyrillic, case system",
    richSeed: true,
    glyph: "Ж",
    glyphReading: "zhe",
  },
  {
    code: "asl",
    name: "American Sign Language",
    nativeName: "ASL",
    flag: "🤟",
    // No voice, so nothing to synthesise. Spoken-word features that assume a
    // BCP-47 tag are gated on this being null.
    bcp47: null,
    modality: "signed",
    // Letters are written A-Z in ASL fingerspelling; the romanization layer
    // carries the names ("A" is spelled "ay").
    needsRomanization: true,
    blurb: "Fingerspelling and handshape",
    richSeed: true,
    glyph: "🤟",
    glyphReading: "ASL",
  },
];

/** The full registry: each language plus the real size of its corpus list. */
export const LANGUAGES: LanguageMeta[] = LANGUAGE_SPECS.map((spec) => ({
  ...spec,
  frequencyListSize: FREQUENCY_META[spec.code]?.size ?? 0,
}));

export interface NativeLanguageMeta {
  code: NativeLanguageCode;
  name: string;
  nativeName: string;
}

export const NATIVE_LANGUAGES: NativeLanguageMeta[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
];

const LANGUAGE_MAP = new Map(LANGUAGES.map((l) => [l.code, l]));
const NATIVE_MAP = new Map(NATIVE_LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: LanguageCode): LanguageMeta {
  return LANGUAGE_MAP.get(code) ?? LANGUAGES[0];
}

export function getNativeLanguage(code: NativeLanguageCode): NativeLanguageMeta {
  return NATIVE_MAP.get(code) ?? NATIVE_LANGUAGES[0];
}

/** Milestone ladder shown on the Progress screen. */
export const FREQUENCY_MILESTONES = [100, 250, 500, 1000, 2000, 3000] as const;
