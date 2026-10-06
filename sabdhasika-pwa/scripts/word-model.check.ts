import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  WORD_CONFIDENCE_THRESHOLD,
  classifyWord,
  wordForward,
  type WordModel,
} from "@/lib/sign/word-model";
import { RESAMPLE_LEN } from "@/lib/sign/word-dtw";

type Check = (name: string, condition: boolean, detail?: unknown) => void;

/** Zero-weight toy: 2-dim frames, 1 LSTM unit, 3 classes → uniform softmax. */
function flatModel(): WordModel {
  const zeros2x4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  return {
    version: 1,
    seqLen: 3,
    featureDim: 2,
    lstmUnits: 1,
    hidden: [2],
    classes: ["hello", "thanks", "please"],
    mean: [0, 0],
    std: [1, 1],
    lstm: { kernel: zeros2x4, recurrent: [[0, 0, 0, 0]], bias: [0, 0, 0, 0] },
    layers: [{ w: [[0], [0], [0]], b: [0, 0, 0] }],
  };
}

/**
 * Word-sign LSTM classifier, checked without a camera.
 *
 * Seams under test: `wordForward` and `classifyWord` in
 * `src/lib/sign/word-model.ts`. The flat model has hand-computed behaviour:
 * every gate sees 0, the cell stays 0, logits stay 0, the softmax is uniform
 * and therefore below threshold — an unsure model says "no word".
 */
export function checkWordModel(check: Check): void {
  const flat = flatModel();
  const seq = [
    [0.3, -0.2],
    [0.1, 0.4],
    [0, 0],
  ];
  const probs = wordForward(flat, seq);
  check("forward returns one probability per class", probs.length === 3, probs.length);
  check("every probability is in [0,1]", probs.every((p) => p >= 0 && p <= 1));
  const sum = probs.reduce((x, y) => x + y, 0);
  check("the probabilities sum to 1", Math.abs(sum - 1) < 1e-6, sum);
  check("zero weights yield a uniform vote", probs.every((p) => Math.abs(p - 1 / 3) < 1e-6), probs.join(","));

  const unsure = classifyWord(flat, seq);
  check("an unsure model reports no word", unsure.word === null, unsure.word);
  check("and reports its low confidence", unsure.confidence < WORD_CONFIDENCE_THRESHOLD);
  check("classifying no sequence reports no word", classifyWord(flat, []).word === null);
  check("a wrong-width frame reports no word", classifyWord(flat, [[1, 2, 3]]).word === null);

  // Longer than seqLen is resampled, not rejected.
  const long = Array.from({ length: 40 }, () => [0.2, 0.1]);
  check("a long attempt still yields a distribution", wordForward(flat, long).length === 3);

  let threw = false;
  try {
    wordForward(flat, []);
    wordForward(flat, [[NaN, 0]]);
    classifyWord(flat, null as unknown as number[][]);
  } catch {
    threw = true;
  }
  check("never throws on degenerate input", !threw);

  // ── the trained model, once it exists ─────────────────────────────
  const modelPath = join(process.cwd(), "src", "lib", "sign", "word-model.json");
  if (!existsSync(modelPath)) {
    check("trained word-model checks skipped until `node scripts/train-word-model.mjs`", true);
    return;
  }
  const model = JSON.parse(readFileSync(modelPath, "utf8")) as WordModel;
  check("the model's sequence length is the resample constant", model.seqLen === RESAMPLE_LEN, model.seqLen);
  check("the model reads 20-dim frames", model.featureDim === 20, model.featureDim);
  check("the model covers the 24 pilot words", model.classes.length === 24, model.classes.length);
  const zeros = Array.from({ length: RESAMPLE_LEN }, () => new Array(20).fill(0));
  const trained = wordForward(model, zeros);
  check(
    "the trained model yields a distribution",
    trained.length === 24 && Math.abs(trained.reduce((x, y) => x + y, 0) - 1) < 1e-4,
  );
  const prediction = classifyWord(model, zeros);
  check(
    "the trained model classifies without throwing",
    prediction.word === null || model.classes.includes(prediction.word),
    prediction.word,
  );
}
