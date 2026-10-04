import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_DIM, extractFeatures, type Landmark } from "@/lib/sign/features";
import { CONFIDENCE_THRESHOLD, classify, forward, type SignModel } from "@/lib/sign/model";
import { TRAINABLE_LETTERS } from "@/lib/sign/samples";

type Check = (name: string, condition: boolean, detail?: unknown) => void;

/** A deterministic, finite 21-landmark hand — shape irrelevant to these checks. */
const FIXTURE: Landmark[] = Array.from({ length: 21 }, (_, i) => ({
  x: 0.5 + Math.cos(i) * 0.1,
  y: 0.5 + Math.sin(i) * 0.1,
  z: 0,
}));

/**
 * The sign recogniser, checked without a camera.
 *
 * Two things are defended. First, the feature extractor is total: whatever it
 * is handed — nothing, half a hand, NaNs — it returns a usable vector or
 * `null`, and never throws, because it runs inside a frame loop where a throw
 * would kill recognition for the rest of the session. Second, once a model has
 * been trained, its shape is exactly what the runtime expects and its output is
 * a real probability distribution.
 *
 * The model checks are skipped until the first training run, so CI stays green
 * on a fresh clone.
 */
export function checkSignRecognition(check: Check): void {
  // ── the extractor is total ──────────────────────────────────────────
  const features = extractFeatures(FIXTURE, "Right");
  check("a full hand yields a feature vector", features !== null);
  check(
    "the vector has the expected length",
    features?.values.length === FEATURE_DIM,
    features?.values.length,
  );
  check(
    "every feature is finite",
    Boolean(features?.values.every((v) => Number.isFinite(v))),
  );

  check("no hand returns null", extractFeatures(null) === null);
  check("an empty hand returns null", extractFeatures([]) === null);
  check(
    "a short hand returns null",
    extractFeatures(FIXTURE.slice(0, 20)) === null,
  );
  check(
    "a hand with NaNs returns null",
    extractFeatures(Array.from({ length: 21 }, () => ({ x: NaN, y: 0 }))) === null,
  );

  let threw = false;
  try {
    extractFeatures(undefined);
    extractFeatures([{ x: 1, y: 1 }]);
    extractFeatures(FIXTURE, "Left");
    extractFeatures(FIXTURE, undefined);
  } catch {
    threw = true;
  }
  check("never throws, whatever it is handed", !threw);

  // ── determinism ─────────────────────────────────────────────────────
  const a = extractFeatures(FIXTURE, "Right")?.values;
  const b = extractFeatures(FIXTURE, "Right")?.values;
  check(
    "the same hand yields the same vector",
    Boolean(a && b && a.every((v, i) => v === b[i])),
  );

  // A left hand is mirrored to the right-hand frame, so the vector exists and
  // is a different shape from the unmirrored one.
  const left = extractFeatures(FIXTURE, "Left")?.values;
  check("a left hand still yields a vector", Boolean(left && left.length === FEATURE_DIM));
  check(
    "mirroring a hand changes its features",
    Boolean(left && a && left.some((v, i) => v !== a[i])),
  );

  // ── forward pass is a distribution ──────────────────────────────────
  const classes = TRAINABLE_LETTERS.slice();
  // A deliberately flat model: zero final weights and biases → uniform softmax.
  const flat: SignModel = {
    version: 1,
    featureDim: FEATURE_DIM,
    hidden: [4],
    classes,
    mean: new Array(FEATURE_DIM).fill(0),
    std: new Array(FEATURE_DIM).fill(1),
    layers: [
      { w: Array.from({ length: 4 }, () => new Array(FEATURE_DIM).fill(0.01)), b: [0, 0, 0, 0] },
      { w: Array.from({ length: classes.length }, () => new Array(4).fill(0)), b: new Array(classes.length).fill(0) },
    ],
  };
  const probs = forward(flat, new Array(FEATURE_DIM).fill(0.3));
  check("forward returns one probability per class", probs.length === classes.length, probs.length);
  check("every probability is in [0,1]", probs.every((p) => p >= 0 && p <= 1));
  const sum = probs.reduce((x, y) => x + y, 0);
  check("the probabilities sum to 1", Math.abs(sum - 1) < 1e-6, sum);
  check("a wrong-length input yields nothing", forward(flat, [1, 2, 3]).length === 0);

  // A uniform distribution is below the threshold, so an unsure model says
  // "no letter" rather than guessing.
  const unsure = classify(flat, { values: new Array(FEATURE_DIM).fill(0.3) });
  check("an unsure model reports no letter", unsure.letter === null, unsure.letter);
  check("and reports its low confidence", unsure.confidence < CONFIDENCE_THRESHOLD);
  check("classifying no hand reports no letter", classify(flat, null).letter === null);

  // ── the trained model, once it exists ───────────────────────────────
  const modelPath = join(process.cwd(), "src", "lib", "sign", "model.json");
  if (!existsSync(modelPath)) {
    check("trained model checks skipped until first `npm run sign:train`", true);
    return;
  }

  const model = JSON.parse(readFileSync(modelPath, "utf8")) as SignModel;
  check("the model's feature dimension matches the extractor", model.featureDim === FEATURE_DIM, model.featureDim);
  check("the model has 24 classes", model.classes.length === 24, model.classes.length);
  check("the model excludes J and Z", !model.classes.includes("J") && !model.classes.includes("Z"), model.classes.join(""));
  check(
    "every trainable letter has a class",
    TRAINABLE_LETTERS.every((c) => model.classes.includes(c)),
  );
  check(
    "every class is a trainable letter",
    model.classes.every((c) => TRAINABLE_LETTERS.includes(c)),
  );
  check("the layers are well formed", model.layers.length === model.hidden.length + 1);
  const trained = forward(model, new Array(FEATURE_DIM).fill(0));
  check("the trained model yields a distribution", trained.length === 24 && Math.abs(trained.reduce((x, y) => x + y, 0) - 1) < 1e-4);
  if (features) {
    const prediction = classify(model, features);
    check(
      "the trained model classifies a hand without throwing",
      prediction.letter === null || model.classes.includes(prediction.letter),
      prediction.letter,
    );
  }
}
