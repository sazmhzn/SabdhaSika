/**
 * Practice words for the ASL fingerspelling drill.
 *
 * Each word uses only the 24 trainable letters (A–Y minus J and Z), so the
 * recogniser can verify every letter the learner signs. Words are grouped by
 * difficulty — shorter and more distinct first, longer and more crowded after —
 * so a session can start easy and ramp up naturally.
 *
 * The tiers are intentionally small so a practice round stays under two minutes
 * even on hard. The total set is large enough that most sessions see fresh words.
 */

export type Difficulty = "easy" | "medium" | "hard";

export interface PracticeWord {
  word: string;
  hint: string;
  difficulty: Difficulty;
}

/** Letters the live recogniser can classify. */
const ALLOWED = new Set("ABCDEFGHIKLMNOPQRSTUVWXY".split(""));

function ok(word: string): boolean {
  return word.split("").every((ch) => ALLOWED.has(ch.toUpperCase()));
}

const RAW: Array<{ word: string; hint: string; difficulty: Difficulty }> = [
  // ── easy (3 letters) ─────────────────────────────────────────────────
  { word: "CAT", hint: "A furry pet that meows", difficulty: "easy" },
  { word: "DOG", hint: "Man's best friend", difficulty: "easy" },
  { word: "SUN", hint: "The star at the centre of our solar system", difficulty: "easy" },
  { word: "RUN", hint: "Move faster than a walk", difficulty: "easy" },
  { word: "CUP", hint: "You drink from it", difficulty: "easy" },
  { word: "HAT", hint: "Worn on your head", difficulty: "easy" },
  { word: "MAP", hint: "Shows you where to go", difficulty: "easy" },
  { word: "BUS", hint: "Public road transport", difficulty: "easy" },
  { word: "HEN", hint: "A female chicken", difficulty: "easy" },
  { word: "PIG", hint: "A farm animal that oinks", difficulty: "easy" },
  { word: "OWL", hint: "A nocturnal bird", difficulty: "easy" },
  { word: "ANT", hint: "A tiny insect that carries crumbs", difficulty: "easy" },
  { word: "ICE", hint: "Frozen water", difficulty: "easy" },
  { word: "EGG", hint: "A chicken lays them", difficulty: "easy" },
  { word: "ARM", hint: "Part of your upper body", difficulty: "easy" },
  { word: "BOW", hint: "Tied on a gift box", difficulty: "easy" },
  { word: "FAN", hint: "Blows cool air", difficulty: "easy" },
  { word: "GUM", hint: "Chew it but don't swallow", difficulty: "easy" },
  { word: "HOP", hint: "What a rabbit does", difficulty: "easy" },
  { word: "INK", hint: "Used in pens", difficulty: "easy" },

  // ── medium (4 letters) ────────────────────────────────────────────────
  { word: "FISH", hint: "Lives in water and has fins", difficulty: "medium" },
  { word: "MOON", hint: "Earth's natural satellite", difficulty: "medium" },
  { word: "RAIN", hint: "Water falling from clouds", difficulty: "medium" },
  { word: "SHIP", hint: "A large sea vessel", difficulty: "medium" },
  { word: "FROG", hint: "A green amphibian that croaks", difficulty: "medium" },
  { word: "DRUM", hint: "A percussion instrument you hit", difficulty: "medium" },
  { word: "CALM", hint: "Quiet and peaceful", difficulty: "medium" },
  { word: "WAVE", hint: "What water does at the beach", difficulty: "medium" },
  { word: "PARK", hint: "A green open space in a city", difficulty: "medium" },
  { word: "SPIN", hint: "Rotate in place", difficulty: "medium" },
  { word: "CROW", hint: "A large black bird", difficulty: "medium" },
  { word: "SKIP", hint: "Hop over a step", difficulty: "medium" },
  { word: "MILK", hint: "A white drink from cows", difficulty: "medium" },
  { word: "GRIP", hint: "Hold something tightly", difficulty: "medium" },
  { word: "FLIP", hint: "Turn something upside down", difficulty: "medium" },
  { word: "LAMP", hint: "Gives light in a room", difficulty: "medium" },
  { word: "SINK", hint: "You wash hands in it", difficulty: "medium" },
  { word: "VINE", hint: "A climbing plant", difficulty: "medium" },
  { word: "HORN", hint: "Makes a loud warning sound", difficulty: "medium" },
  { word: "BONE", hint: "Part of your skeleton", difficulty: "medium" },

  // ── hard (5–6 letters) ────────────────────────────────────────────────
  { word: "BRUSH", hint: "Used to paint or clean teeth", difficulty: "hard" },
  { word: "BLOOM", hint: "What flowers do in spring", difficulty: "hard" },
  { word: "BRING", hint: "Carry something here", difficulty: "hard" },
  { word: "CRISP", hint: "Thin, crunchy snack", difficulty: "hard" },
  { word: "STORM", hint: "Heavy rain and wind", difficulty: "hard" },
  { word: "GROAN", hint: "A sound of pain or displeasure", difficulty: "hard" },
  { word: "PLUM", hint: "A small purple fruit", difficulty: "hard" },
  { word: "PRISM", hint: "Splits white light into a rainbow", difficulty: "hard" },
  { word: "GROWN", hint: "Past tense of grow", difficulty: "hard" },
  { word: "SNACK", hint: "A small bite between meals", difficulty: "hard" },
  { word: "FRAME", hint: "Goes around a picture", difficulty: "hard" },
  { word: "GLOBE", hint: "A spherical map of the world", difficulty: "hard" },
  { word: "SPINE", hint: "Your backbone", difficulty: "hard" },
  { word: "CLAMP", hint: "Holds two things together tightly", difficulty: "hard" },
  { word: "BRISK", hint: "Quick and energetic", difficulty: "hard" },
  { word: "STING", hint: "What a bee does", difficulty: "hard" },
  { word: "PLANK", hint: "A flat piece of wood", difficulty: "hard" },
  { word: "CRUMB", hint: "A tiny piece of bread", difficulty: "hard" },
  { word: "SWING", hint: "A hanging seat in a playground", difficulty: "hard" },
  { word: "STOMP", hint: "Walk with heavy steps", difficulty: "hard" },
];

export const PRACTICE_WORDS: PracticeWord[] = RAW.filter((w) => ok(w.word));

export function getWordsByDifficulty(difficulty: Difficulty): PracticeWord[] {
  return PRACTICE_WORDS.filter((w) => w.difficulty === difficulty);
}

/**
 * Pick `count` words randomly from a difficulty tier, without repeating the
 * last word if there is more than one option.
 */
export function pickWords(difficulty: Difficulty, count: number, exclude: string[] = []): PracticeWord[] {
  const pool = getWordsByDifficulty(difficulty).filter((w) => !exclude.includes(w.word));
  const source = pool.length >= count ? pool : getWordsByDifficulty(difficulty); // fall back if pool is small
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
