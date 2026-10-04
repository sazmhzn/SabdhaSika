/**
 * Train the fingerspelling classifier.
 *
 *   npm run sign:train            # reads scripts/data/sign-samples.json
 *   node scripts/train-sign-model.mjs path/to/samples.json
 *
 * Input is the file exported from `/sign/record`. Output is
 * `src/lib/sign/model.json`, the plain-weights file the browser loads — a
 * compact MLP over the same features the runtime extracts, so there is nothing
 * to convert and no framework in the app itself.
 *
 * Why TensorFlow.js rather than a hand-rolled trainer: it is a real optimiser
 * with a real loss, it is free, and it runs in plain Node on this machine with
 * no native build step (this box's Python 3.14 is ahead of the MediaPipe and
 * PyTorch wheels).
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as tf from "@tensorflow/tfjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = join(ROOT, "scripts", "data", "sign-samples.json");
const OUTPUT = join(ROOT, "src", "lib", "sign", "model.json");
/** What the browser actually fetches (`MODEL_URL` in src/lib/sign/model.ts). */
const PUBLIC_OUTPUT = join(ROOT, "public", "sign-model.json");

/** Must match FEATURE_DIM in src/lib/sign/features.ts. */
const EXPECTED_DIM = 20;
/** The static alphabet, in the order the model will emit. J and Z are motion. */
const CLASSES = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");
const HIDDEN = [64, 32];
const EPOCHS = 200;
const BATCH = 64;
const VAL_FRACTION = 0.15;
const SEED = 1337;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function loadSamples(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new Error(
      `no samples at ${path}. Open /sign/record, capture samples, export the JSON, and save it there.`,
    );
  }
  const parsed = JSON.parse(raw);
  const samples = Array.isArray(parsed) ? parsed : parsed.samples;
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error("the samples file has no samples in it");
  }
  const known = new Set(CLASSES);
  const usable = samples.filter(
    (s) =>
      s &&
      typeof s.label === "string" &&
      known.has(s.label) &&
      Array.isArray(s.values) &&
      s.values.length === EXPECTED_DIM &&
      s.values.every((v) => Number.isFinite(v)),
  );
  if (usable.length === 0) throw new Error("no usable samples (check label spelling and feature length)");
  return usable;
}

function standardise(rows) {
  const dim = rows[0].length;
  const mean = new Array(dim).fill(0);
  const std = new Array(dim).fill(0);
  for (const row of rows) for (let i = 0; i < dim; i++) mean[i] += row[i];
  for (let i = 0; i < dim; i++) mean[i] /= rows.length;
  for (const row of rows) for (let i = 0; i < dim; i++) std[i] += (row[i] - mean[i]) ** 2;
  for (let i = 0; i < dim; i++) std[i] = Math.sqrt(std[i] / rows.length) || 1;
  return { mean, std };
}

async function main() {
  const inputPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_INPUT;
  const samples = await loadSamples(inputPath);

  const counts = {};
  for (const s of samples) counts[s.label] = (counts[s.label] ?? 0) + 1;
  const missing = CLASSES.filter((c) => !counts[c]);
  console.log(`loaded ${samples.length} samples across ${Object.keys(counts).length} letters`);
  if (missing.length) console.log(`note: no samples for ${missing.join(", ")} — they will never be predicted`);
  const thin = CLASSES.filter((c) => (counts[c] ?? 0) > 0 && (counts[c] ?? 0) < 15);
  if (thin.length) console.log(`note: thin classes (<15 samples): ${thin.join(", ")}`);

  const rows = samples.map((s) => s.values);
  const { mean, std } = standardise(rows);
  const standardised = rows.map((row) => row.map((v, i) => (v - mean[i]) / std[i]));
  const yIndex = samples.map((s) => CLASSES.indexOf(s.label));

  // Shuffle once, deterministically, then split.
  const rng = mulberry32(SEED);
  const order = samples.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const valCount = Math.max(1, Math.floor(order.length * VAL_FRACTION));
  const valIdx = order.slice(0, valCount);
  const trainIdx = order.slice(valCount);

  const xTrain = tf.tensor2d(trainIdx.map((i) => standardised[i]));
  const yTrain = tf.oneHot(tf.tensor1d(trainIdx.map((i) => yIndex[i]), "int32"), CLASSES.length);
  const xVal = tf.tensor2d(valIdx.map((i) => standardised[i]));
  const yValIdx = tf.tensor1d(valIdx.map((i) => yIndex[i]), "int32");
  const yVal = tf.oneHot(yValIdx, CLASSES.length);

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: HIDDEN[0], activation: "relu", inputShape: [EXPECTED_DIM] }));
  model.add(tf.layers.dense({ units: HIDDEN[1], activation: "relu" }));
  model.add(tf.layers.dense({ units: CLASSES.length, activation: "softmax" }));
  model.compile({ optimizer: tf.train.adam(0.002), loss: "categoricalCrossentropy", metrics: ["accuracy"] });

  console.log(`training ${EXPECTED_DIM} → ${HIDDEN.join(" → ")} → ${CLASSES.length} …`);
  await model.fit(xTrain, yTrain, {
    epochs: EPOCHS,
    batchSize: BATCH,
    validationData: [xVal, yVal],
    shuffle: true,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 25 === 0) {
          console.log(
            `  epoch ${String(epoch + 1).padStart(3)}  loss ${logs.loss.toFixed(4)}  val_acc ${logs.val_acc.toFixed(4)}`,
          );
        }
      },
    },
  });

  // Overall + per-letter validation accuracy.
  const predIdx = model.predict(xVal).argMax(-1);
  const preds = await predIdx.data();
  const truth = await yValIdx.data();
  let correct = 0;
  const perClass = {};
  for (let k = 0; k < truth.length; k++) {
    const t = CLASSES[truth[k]];
    const ok = preds[k] === truth[k];
    if (ok) correct++;
    const entry = (perClass[t] ??= { n: 0, ok: 0 });
    entry.n++;
    if (ok) entry.ok++;
  }
  console.log(`\nvalidation accuracy: ${(correct / truth.length * 100).toFixed(1)}% (${correct}/${truth.length})`);
  const weak = CLASSES.filter((c) => perClass[c] && perClass[c].ok / perClass[c].n < 0.6);
  if (weak.length) console.log(`weak letters: ${weak.map((c) => `${c} (${Math.round((perClass[c].ok / perClass[c].n) * 100)}%)`).join(", ")}`);

  // Export as plain weights. tfjs stores Dense kernels as [in, out]; the
  // runtime multiplies w[out][in], so the kernel is transposed on the way out.
  const layers = [];
  for (const layer of model.layers) {
    const [kernel, bias] = layer.getWeights();
    const [kernelData, biasData] = await Promise.all([kernel.data(), bias.data()]);
    const inDim = kernel.shape[0];
    const outDim = kernel.shape[1];
    const w = [];
    for (let o = 0; o < outDim; o++) {
      const row = new Array(inDim);
      for (let i = 0; i < inDim; i++) row[i] = kernelData[i * outDim + o];
      w.push(row);
    }
    layers.push({ w, b: Array.from(biasData) });
  }

  const payload = {
    version: 1,
    featureDim: EXPECTED_DIM,
    hidden: HIDDEN,
    classes: CLASSES,
    mean,
    std,
    layers,
  };
  await writeFile(OUTPUT, JSON.stringify(payload));
  await writeFile(PUBLIC_OUTPUT, JSON.stringify(payload));
  console.log(`\nwrote ${OUTPUT}`);
  console.log(`wrote ${PUBLIC_OUTPUT}`);

  tf.dispose([xTrain, yTrain, xVal, yVal, yValIdx, predIdx]);
}

main().catch((err) => {
  console.error(`train-sign-model: ${err.message}`);
  process.exit(1);
});
