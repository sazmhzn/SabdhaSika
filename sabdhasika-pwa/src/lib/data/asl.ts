import type { LanguageCode } from "@/lib/types";

/**
 * American Sign Language — fingerspelling and the handshapes built from it.
 *
 * WHY FINGERSPELLING, AND WHY NOT WORD-SIGN CLIPS
 * ----------------------------------------------
 * The obvious build would be to ship ~300 short videos of ASL word signs. That
 * is not available in a shippable form:
 *
 *  · WLASL, the main word-level ASL corpus, is licensed under C-UDA and its
 *    README states the data is for "academic and computational use only. No
 *    commercial usage is allowed." It is not ours to redistribute.
 *  · Its clips are YouTube videos pulled with yt-dlp. YouTube's terms do not
 *    permit downloading, and do not permit embedding on a third-party site.
 *  · ASLLVD and SpreadTheSign are research-use and personal-use respectively.
 *
 * So rather than ship something illegally sourced, or quietly label borrowed
 * Nepali Sign Language video as "Nepali", this track teaches what is genuinely
 * ours to teach and genuinely useful first: the manual alphabet, the number
 * handshapes, and the handshape system the rest of the language is built from.
 *
 * That is not a consolation prize. Fingerspelling is how ASL is written, how
 * names and places are spelled, and how a learner reads anything that has no
 * conventional sign — and the handshapes are the phonemes of the language. A
 * learner who owns the alphabet can write their own name and look up anything
 * else.
 *
 * Each handshape is described as *finger extension* and *finger curl*, which
 * is how signing reference materials actually specify handshapes. Rendering a
 * schematic hand from that description is honest: it is a diagram, not a
 * photograph of a signer, and it says so.
 */

export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";

/** 1 = straight out, 0 = fully curled into the palm. */
export type FingerExtension = Record<Finger, number>;

export interface Handshape {
  /** The letter or digit this handshape spells. */
  symbol: string;
  /** How it is usually named when spoken aloud, e.g. A = "ay". */
  spokenName: string;
  /** What a teacher would say while demonstrating it. */
  cue: string;
  /** Finger extension, 0-1 each. */
  hand: FingerExtension;
  /** Thumb placement, which often distinguishes otherwise identical hands. */
  thumb: "across-palm" | "out-to-side" | "alongside-index" | "touching-middle" | "between" | "in-fist";
  /**
   * True when the handshape rests in a palm the other hand faces — the rest
   * position. Modelled explicitly because it is the baseline for the rest.
   */
  resting?: boolean;
  /** Rotation of the wrist, degrees, 0 = palm out. */
  rotation?: number;
  /** One line on how to check you have it right. */
  check: string;
}

const hand = (
  thumb: number,
  index: number,
  middle: number,
  ring: number,
  pinky: number,
): FingerExtension => ({ thumb, index, middle, ring, pinky });

/**
 * The manual alphabet, in teaching order.
 *
 * Ordered as a *fingerspelling* course rather than alphabetically: the flat
 * fist and the flat hand come first because almost every letter is a
 * modification of one of them, so a learner has an anchor to move away from
 * and return to.
 */
export const FINGERSPELLING: Handshape[] = [
  {
    symbol: "A",
    spokenName: "ay",
    cue: "Fist, thumb resting along the side",
    hand: hand(0.15, 1, 1, 1, 1),
    thumb: "alongside-index",
    check: "Fingertips touch the thumb in a clean fist, thumb outside the fingers.",
  },
  {
    symbol: "B",
    spokenName: "bee",
    cue: "Flat hand, fingers together, thumb across the palm",
    hand: hand(0.9, 1, 1, 1, 1),
    thumb: "across-palm",
    check: "Four fingers straight and together, thumb folded across them.",
  },
  {
    symbol: "C",
    spokenName: "see",
    cue: "Both fingers curved, thumb opposite — holding a letter C",
    hand: hand(0.6, 0.5, 0.5, 1, 1),
    thumb: "out-to-side",
    check: "Palm faces sideways. Thumb and index keep a visible gap — not closed.",
  },
  {
    symbol: "D",
    spokenName: "dee",
    cue: "Index up, thumb touching the tips of the middle fingers",
    hand: hand(0.5, 1, 0.45, 0.45, 0.4),
    thumb: "touching-middle",
    check: "Index stands straight up. The other three curl to meet the thumb.",
  },
  {
    symbol: "E",
    spokenName: "ee",
    cue: "Fingers curled down over the thumb",
    hand: hand(0.5, 0.35, 0.35, 0.35, 0.35),
    thumb: "across-palm",
    check: "Fingertips rest on the folded thumb, thumb hidden under them.",
  },
  {
    symbol: "F",
    spokenName: "eff",
    cue: "Thumb and index touch in a circle, other three up",
    hand: hand(0.8, 0.3, 1, 1, 1),
    thumb: "touching-middle",
    check: "Index curves down to the thumb. Middle, ring and pinky stay up.",
  },
  {
    symbol: "G",
    spokenName: "gee",
    cue: "Index and thumb horizontal, pointing sideways",
    hand: hand(0.8, 0.9, 0.15, 0.15, 0.15),
    thumb: "alongside-index",
    rotation: 90,
    check: "Palm faces you. Index and thumb point sideways and level with each other.",
  },
  {
    symbol: "H",
    spokenName: "aitch",
    cue: "Index and middle together, pointing sideways",
    hand: hand(0.3, 0.9, 0.9, 0.15, 0.15),
    thumb: "across-palm",
    rotation: 90,
    check: "Palm faces you. Index and middle are straight, side by side, together.",
  },
  {
    symbol: "I",
    spokenName: "eye",
    cue: "Pinkie up",
    hand: hand(0.2, 0.15, 0.15, 0.15, 1),
    thumb: "across-palm",
    check: "Only the pinkie is extended. Everything else folds down.",
  },
  {
    symbol: "J",
    spokenName: "jay",
    cue: "Pinkie up, drawing a J",
    hand: hand(0.2, 0.15, 0.15, 0.15, 1),
    thumb: "across-palm",
    check: "Same hand as I, but you trace a J in the air with the pinkie.",
  },
  {
    symbol: "K",
    spokenName: "kay",
    cue: "Index and middle up and apart, thumb up between them",
    hand: hand(0.9, 1, 1, 0.15, 0.15),
    thumb: "between",
    check: "Palm faces out. Thumb points up, touching the middle of the other two.",
  },
  {
    symbol: "L",
    spokenName: "el",
    cue: "Index up, thumb horizontal — an L shape",
    hand: hand(0.9, 1, 0.15, 0.15, 0.15),
    thumb: "out-to-side",
    check: "Thumb and index make a right angle. The other fingers stay down.",
  },
  {
    symbol: "M",
    spokenName: "em",
    cue: "Three fingers over the thumb",
    hand: hand(0.5, 0.25, 0.25, 0.25, 1),
    thumb: "in-fist",
    check: "Thumb under the index, middle and ring. Only the pinkie stays up.",
  },
  {
    symbol: "N",
    spokenName: "en",
    cue: "Two fingers over the thumb",
    hand: hand(0.5, 0.25, 0.25, 1, 1),
    thumb: "in-fist",
    check: "Thumb under index and middle. Ring and pinkie stay up.",
  },
  {
    symbol: "O",
    spokenName: "oh",
    cue: "All fingertips meet the thumb, forming an O",
    hand: hand(0.85, 0.55, 0.55, 0.55, 0.55),
    thumb: "touching-middle",
    check: "Palm faces out. There is a clear round hole in the middle of the hand.",
  },
  {
    symbol: "P",
    spokenName: "pee",
    cue: "K pointing downward",
    hand: hand(0.6, 1, 1, 0.15, 0.15),
    thumb: "between",
    rotation: 180,
    check: "The K handshape, but the whole hand points at the floor.",
  },
  {
    symbol: "Q",
    spokenName: "cue",
    cue: "G pointing downward",
    hand: hand(0.8, 0.9, 0.15, 0.15, 0.15),
    thumb: "alongside-index",
    rotation: 180,
    check: "The G handshape, but the whole hand points at the floor.",
  },
  {
    symbol: "R",
    spokenName: "ar",
    cue: "Index and middle crossed",
    hand: hand(0.2, 1, 1, 0.15, 0.15),
    thumb: "across-palm",
    check: "Palm faces you. Index and middle cross over each other.",
  },
  {
    symbol: "S",
    spokenName: "ess",
    cue: "Fist, thumb across the front",
    hand: hand(0.85, 0.2, 0.2, 0.2, 0.2),
    thumb: "across-palm",
    check: "Fingers curled, thumb laid across the front of the fist.",
  },
  {
    symbol: "T",
    spokenName: "tee",
    cue: "Thumb between index and middle",
    hand: hand(0.5, 0.3, 0.3, 0.15, 0.15),
    thumb: "between",
    check: "Fingers curled down. Thumb pokes up between index and middle.",
  },
  {
    symbol: "U",
    spokenName: "you",
    cue: "Index and middle together, pointing up",
    hand: hand(0.2, 1, 1, 0.15, 0.15),
    thumb: "across-palm",
    check: "Palm faces you. Index and middle are straight and touching.",
  },
  {
    symbol: "V",
    spokenName: "vee",
    cue: "Index and middle apart, like a V",
    hand: hand(0.2, 1, 1, 0.15, 0.15),
    thumb: "across-palm",
    check: "Palm faces you. Index and middle spread apart — the V is the point.",
  },
  {
    symbol: "W",
    spokenName: "double-you",
    cue: "Index, middle and ring up, apart",
    hand: hand(0.2, 1, 1, 1, 0.15),
    thumb: "across-palm",
    check: "Three fingers up and spread. Pinkie stays folded.",
  },
  {
    symbol: "X",
    spokenName: "ex",
    cue: "Index hooked into a fist",
    hand: hand(0.2, 0.4, 0.2, 0.2, 0.2),
    thumb: "across-palm",
    check: "Index bends into a hook. The other fingers form a fist.",
  },
  {
    symbol: "Y",
    spokenName: "why",
    cue: "Thumb and pinkie out",
    hand: hand(1, 0.15, 0.15, 0.15, 1),
    thumb: "out-to-side",
    check: "Thumb and pinkie stick straight out. Middle three fold down.",
  },
  {
    symbol: "Z",
    spokenName: "zee",
    cue: "Index draws a Z",
    hand: hand(0.2, 1, 0.15, 0.15, 0.15),
    thumb: "across-palm",
    check: "The D handshape, with the index tracing a Z in the air.",
  },
];

/** Number handshapes 0-9. Distinct from fingerspelled digits for 6-9. */
export const NUMBERS: Handshape[] = [
  {
    symbol: "0",
    spokenName: "zero",
    cue: "All fingers together, thumb alongside — the O shape",
    hand: hand(0.85, 0.5, 0.5, 0.5, 0.5),
    thumb: "out-to-side",
    check: "All five fingertips meet. The hand is a closed shape, not a fist.",
  },
  {
    symbol: "1",
    spokenName: "one",
    cue: "Index up",
    hand: hand(0.15, 1, 0.15, 0.15, 0.15),
    thumb: "across-palm",
    check: "One finger up. Palm faces the reader, or sideways for a count.",
  },
  {
    symbol: "2",
    spokenName: "two",
    cue: "Index and middle up",
    hand: hand(0.15, 1, 1, 0.15, 0.15),
    thumb: "across-palm",
    check: "Two fingers up and apart.",
  },
  {
    symbol: "3",
    spokenName: "three",
    cue: "Thumb, index and middle out",
    hand: hand(1, 1, 1, 0.15, 0.15),
    thumb: "out-to-side",
    check: "Thumb and the first two fingers extended — a W in some regions.",
  },
  {
    symbol: "4",
    spokenName: "four",
    cue: "Four fingers up, thumb across",
    hand: hand(0.15, 1, 1, 1, 1),
    thumb: "across-palm",
    check: "Four fingers straight up. Thumb lies across the palm.",
  },
  {
    symbol: "5",
    spokenName: "five",
    cue: "Open hand",
    hand: hand(1, 1, 1, 1, 1),
    thumb: "out-to-side",
    check: "All five spread wide apart.",
  },
  {
    symbol: "6",
    spokenName: "six",
    cue: "Thumb tucked against the pinkie",
    hand: hand(0.3, 0.7, 0.7, 0.7, 1),
    thumb: "touching-middle",
    check: "Like a five, but the thumb rests against the side of the pinkie.",
  },
  {
    symbol: "7",
    spokenName: "seven",
    cue: "Ring finger hooked over the middle",
    hand: hand(0.15, 1, 0.6, 0.5, 0.6),
    thumb: "across-palm",
    check: "Ring curls across the middle finger. Thumb, index and pinkie stay up.",
  },
  {
    symbol: "8",
    spokenName: "eight",
    cue: "Middle finger hooked over the index",
    hand: hand(0.15, 0.6, 0.5, 1, 0.6),
    thumb: "across-palm",
    check: "Middle curls across the index. Thumb, ring and pinkie stay up.",
  },
  {
    symbol: "9",
    spokenName: "nine",
    cue: "Like a fist with one finger hooked",
    hand: hand(0.15, 0.5, 0.6, 0.4, 0.4),
    thumb: "across-palm",
    check: "Index hooks across the fist. The rest is curled in.",
  },
];

/** The rest position — the handshape a signed space returns to. */
export const REST_POSITION: Handshape = {
  symbol: "rest",
  spokenName: "rest",
  cue: "The hand held up, fingers together",
  hand: hand(0.9, 1, 1, 1, 1),
  thumb: "across-palm",
  resting: true,
  check: "Flat hand, fingers together, thumb folded. This is where a sign starts and ends.",
};

export const HAND_SHAPES: Handshape[] = [...FINGERSPELLING, ...NUMBERS];

export function handshapeFor(symbol: string): Handshape | undefined {
  const key = symbol.trim().toUpperCase();
  return HAND_SHAPES.find((h) => h.symbol === key);
}

/* ------------------------------------------------------------------ *
 * The syllabus the session engine actually reads.
 * ------------------------------------------------------------------ */

export interface AslWordSpec {
  /** The letter or digit, as the learner would write it. */
  word: string;
  /** Its English meaning, which here is the spoken name of the handshape. */
  meaning: string;
  /** How the symbol is spoken aloud when spelled, e.g. "ay" for A. */
  romanized: string;
  hint: string;
  /** Which group it belongs to, for the review screen. */
  group: "letters" | "numbers" | "rest";
}

/**
 * Syllabus order.
 *
 * Not alphabetical and not frequency-ranked — sign languages have no published
 * frequency list. This is ordered the way fingerspelling is actually taught:
 * the baseline hands first, then one change at a time from them, with the
 * movement letters and the numbers at the end.
 *
 * The ordinal, not a frequency rank, is what orders this track. `frequencyRank`
 * stays 0 everywhere so that no screen can report a corpus position that was
 * never computed.
 */
const ORDER: Array<[string, AslWordSpec["group"]]> = [
  ["B", "letters"],
  ["A", "letters"],
  ["rest", "rest"],
  ["C", "letters"],
  ["D", "letters"],
  ["E", "letters"],
  ["F", "letters"],
  ["G", "letters"],
  ["H", "letters"],
  ["I", "letters"],
  ["K", "letters"],
  ["L", "letters"],
  ["M", "letters"],
  ["N", "letters"],
  ["O", "letters"],
  ["P", "letters"],
  ["Q", "letters"],
  ["R", "letters"],
  ["S", "letters"],
  ["T", "letters"],
  ["U", "letters"],
  ["V", "letters"],
  ["W", "letters"],
  ["X", "letters"],
  ["Y", "letters"],
  ["J", "letters"],
  ["Z", "letters"],
  ["0", "numbers"],
  ["1", "numbers"],
  ["2", "numbers"],
  ["3", "numbers"],
  ["4", "numbers"],
  ["5", "numbers"],
  ["6", "numbers"],
  ["7", "numbers"],
  ["8", "numbers"],
  ["9", "numbers"],
];

const GROUP_NAMES: Record<AslWordSpec["group"], string> = {
  letters: "Manual alphabet",
  numbers: "Number handshapes",
  rest: "Rest position",
};

export interface AslWord {
  id: string;
  language: LanguageCode;
  word: string;
  meaning: string;
  romanized: string;
  /** Teaching order. 1 comes first. */
  syllabusOrdinal: number;
  frequencyRank: 0;
  handshape: Handshape;
  group: AslWordSpec["group"];
  groupName: string;
}

export const ASL: AslWord[] = ORDER.map(([symbol, group], i) => {
  const shape = handshapeFor(symbol) ?? REST_POSITION;
  return {
    id: `asl-${symbol === "rest" ? "rest" : symbol.toLowerCase()}`,
    language: "asl",
    word: symbol === "rest" ? "✋" : symbol,
    meaning: symbol === "rest" ? "Rest position" : `Letter ${symbol}`,
    romanized: shape.spokenName,
    syllabusOrdinal: i + 1,
    frequencyRank: 0,
    handshape: shape,
    group,
    groupName: GROUP_NAMES[group],
  };
});