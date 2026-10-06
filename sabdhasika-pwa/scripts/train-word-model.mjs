/**
 * Train the word-sign LSTM classifier.
 *
 *   node scripts/train-word-model.mjs
 *
 * Input is `scripts/data/sl-templates.json` (written by
 * `scripts/sign-words/extract.py`). Output is `src/lib/sign/word-model.json`
 * plus its `public/` twin — plain weights the browser reads with the
 * hand-rolled forward pass in `src/lib/sign/word-model.ts`, so the app ships
 * no framework. Same convention as `train-sign-model.mjs`.
 *
 * Honest evaluation: the FIRST sequence of every word is held out before any
 * augmentation and never trained on. Reported accuracy is measured on those
 * 24 unseen clips — not on the training set.
 *
 * Why augmentation: ~3 clips per word cannot train an LSTM. Each training
 * clip is expanded with time warps, jitter and amplitude scales (all
 * label-preserving for sign trajectories), deterministically seeded.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as tf from "@tensorflow/tfjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = join(ROOT, "scripts", "data", "sl-templates.json");
const OUTPUT = join(ROOT, "src", "lib", "sign", "word-model.json");
/** What the browser actually fetches (`WORD_MODEL_URL` in src/lib/sign/word-model.ts). */
const PUBLIC_OUTPUT = join(ROOT, "public", "word-model.json");

/** Must match PILOT_WORDS order in src/lib/sign/word-clips.ts (slugified). */
const CLASSES = [
  "hello", "thank-you", "please", "yes", "no", "good", "bad", "friend",
  "family", "love", "help", "eat", "drink", "water", "house", "school",
  "book", "time", "day", "night", "morning", "today", "what", "how",
];
const SEQ_LEN = 48;
const FEATURE_DIM = 20;
const LSTM_UNITS = 16;
const DENSE = 32;
const EPOCHS = 40;
const BATCH = 64;
const SEED = 20261005;
/** Augmentations per training clip. Deterministic via mulberry32(SEED). */
const AUGMENT_ROUNDS = 6;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slugify(gloss) {
  return gloss.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function resample(frames, n) {
  if (!Array.isArray(frames) || frames.length === 0) return [];
  if (frames.length === 1) return Array.from({ length: n }, () => [...frames[0]]);
  const out = [];
  const last = frames.length - 1;
  for (let i = 0; i < n; i++) {
    const pos = (i * last) / (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(last, lo + 1);
    const t = pos - lo;
    out.push(frames[lo].map((v, d) => v + (frames[hi][d] - v) * t));
  }
  return out;
}

function gauss(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Label-preserving warps of one 48×20 sequence. */
function augment(seq, rng) {
  const kind = Math.floor(rng() * 4);
  if (kind === 0) {
    // Time warp: stretch or squeeze then resample back.
    const factor = 0.8 + rng() * 0.4;
    const warped = resample(seq, Math.max(8, Math.round(seq.length * factor)));
    return resample(warped, SEQ_LEN);
  }
  if (kind === 1) {
    // Jitter: small per-value noise.
    const sigma = 0.01 + rng() * 0.025;
    return seq.map((f) => f.map((x) => x + gauss(rng) * sigma));
  }
  if (kind === 2) {
    // Amplitude scale: signer size variation.
    const s = 0.92 + rng() * 0.16;
    const mean = seq[0].map((_, d) => seq.reduce((a, f) => a + f[d], 0) / seq.length);
    return seq.map((f) => f.map((x, d) => mean[d] + (x - mean[d]) * s));
  }
  // Temporal shift: roll the sequence, wrapping (motion is cyclic-safe here
  // because every clip starts and ends near rest).
  const k = 1 + Math.floor(rng() * (SEQ_LEN - 1));
  return [...seq.slice(k), ...seq.slice(0, k)];
}

async function loadTemplates(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new Error(
      `no templates at ${path}. Run the Python extractor first (see scripts/sign-words/extract.py).`,
    );
  }
  const parsed = JSON.parse(raw);
  const words = parsed.words;
  if (!Array.isArray(words)) throw new Error("templates file has no word list");
  const bySlug = new Map(words.map((w) => [w.slug ?? slugify(w.gloss ?? ""), w.sequences ?? []]));
  const missing = CLASSES.filter((c) => !(bySlug.get(c) ?? []).length);
  if (missing.length) throw new Error(`no sequences for ${missing.join(", ")}`);
  return bySlug;
}

function standardise(frames) {
  const dim = frames[0].length;
  const mean = new Array(dim).fill(0);
  const std = new Array(dim).fill(0);
  for (const f of frames) for (let i = 0; i < dim; i++) mean[i] += f[i];
  for (let i = 0; i < dim; i++) mean[i] /= frames.length;
  for (const f of frames) for (let i = 0; i < dim; i++) std[i] += (f[i] - mean[i]) ** 2;
  for (let i = 0; i < dim; i++) std[i] = Math.sqrt(std[i] / frames.length) || 1;
  return { mean, std };
}

async function main() {
  const inputPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_INPUT;
  const bySlug = await loadTemplates(inputPath);
  const rng = mulberry32(SEED);

  // Hold out the FIRST TWO clips of every word before anything else touches
  // them. With ~9 clips per word this is a real generalisation test.
  const trainSeqs = [];
  const testSeqs = [];
  for (const [idx, slug] of CLASSES.entries()) {
    const seqs = bySlug.get(slug).map((s) => resample(s, SEQ_LEN));
    testSeqs.push({ slug, idx, seq: seqs[0] }, { slug, idx, seq: seqs[1] });
    for (const seq of seqs.slice(1)) {
      trainSeqs.push({ idx, seq });
      for (let r = 0; r < AUGMENT_ROUNDS; r++) trainSeqs.push({ idx, seq: augment(seq, rng) });
    }
  }
  console.log(`train ${trainSeqs.length} sequences (augmented), held-out test ${testSeqs.length} clips`);

  const { mean, std } = standardise(trainSeqs.flatMap((s) => s.seq));
  const norm = (seq) => seq.map((f) => f.map((v, i) => (v - mean[i]) / std[i]));

  const xTrain = tf.tensor3d(trainSeqs.map((s) => norm(s.seq)));
  const yTrain = tf.oneHot(
    tf.tensor1d(trainSeqs.map((s) => s.idx), "int32"),
    CLASSES.length,
  );
  const xTest = tf.tensor3d(testSeqs.map((s) => norm(s.seq)));

  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: LSTM_UNITS, inputShape: [SEQ_LEN, FEATURE_DIM] }));
  model.add(tf.layers.dropout({ rate: 0.25 }));
  model.add(tf.layers.dense({ units: DENSE, activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.15 }));
  model.add(tf.layers.dense({ units: CLASSES.length, activation: "softmax" }));
  model.compile({ optimizer: tf.train.adam(0.002), loss: "categoricalCrossentropy", metrics: ["accuracy"] });

  console.log(`training ${SEQ_LEN}x${FEATURE_DIM} → LSTM(${LSTM_UNITS}) → ${DENSE} → ${CLASSES.length} …`);
  await model.fit(xTrain, yTrain, {
    epochs: EPOCHS,
    batchSize: BATCH,
    shuffle: true,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0) {
          console.log(`  epoch ${String(epoch + 1).padStart(3)}  loss ${logs.loss.toFixed(4)}  acc ${logs.acc.toFixed(4)}`);
        }
      },
    },
  });

  // Honest eval on the held-out clips.
  const probs = await model.predict(xTest).array();
  let correct = 0;
  const perWord = [];
  const confusion = [];
  testSeqs.forEach((t, i) => {
    const p = probs[i];
    let best = 0;
    for (let k = 1; k < p.length; k++) if (p[k] > p[best]) best = k;
    const ok = best === t.idx;
    if (ok) correct++;
    else confusion.push(`${t.slug} → ${CLASSES[best]} (${(p[best] * 100).toFixed(0)}%)`);
    perWord.push(`${t.slug}: ${ok ? "hit" : "MISS"} (${(p[t.idx] * 100).toFixed(0)}% on truth)`);
  });
  console.log(`\nheld-out accuracy: ${(correct / testSeqs.length * 100).toFixed(1)}% (${correct}/${testSeqs.length})`);
  console.log(perWord.map((l) => `  ${l}`).join("\n"));
  if (confusion.length) console.log(`confusions:\n${confusion.map((l) => `  ${l}`).join("\n")}`);

  // Export as plain weights. LSTM gate order is i, f, c, o; dense kernels are
  // [in, out] in tfjs and transposed to w[out][in] for the runtime.
  const [lstmKernel, lstmRecurrent, lstmBias] = model.layers[0].getWeights();
  const [kData, rData, bData] = await Promise.all([
    lstmKernel.data(),
    lstmRecurrent.data(),
    lstmBias.data(),
  ]);
  const G = 4 * LSTM_UNITS;
  const kernel = [];
  for (let i = 0; i < FEATURE_DIM; i++) kernel.push(Array.from(kData.slice(i * G, (i + 1) * G)));
  const recurrent = [];
  for (let j = 0; j < LSTM_UNITS; j++) recurrent.push(Array.from(rData.slice(j * G, (j + 1) * G)));
  const layers = [];
  for (const layer of model.layers.slice(1).filter((l) => l.getWeights().length > 0)) {
    const [k, b] = layer.getWeights();
    const [kD, bD] = await Promise.all([k.data(), b.data()]);
    const inDim = k.shape[0];
    const outDim = k.shape[1];
    const w = [];
    for (let o = 0; o < outDim; o++) {
      const row = new Array(inDim);
      for (let i = 0; i < inDim; i++) row[i] = kD[i * outDim + o];
      w.push(row);
    }
    layers.push({ w, b: Array.from(bD) });
  }

  const payload = {
    version: 1,
    seqLen: SEQ_LEN,
    featureDim: FEATURE_DIM,
    lstmUnits: LSTM_UNITS,
    hidden: [DENSE],
    classes: CLASSES,
    mean,
    std,
    lstm: { kernel, recurrent, bias: Array.from(bData) },
    layers,
  };
  await writeFile(OUTPUT, JSON.stringify(payload));
  await writeFile(PUBLIC_OUTPUT, JSON.stringify(payload));
  console.log(`\nwrote ${OUTPUT}`);
  console.log(`wrote ${PUBLIC_OUTPUT}`);

  tf.dispose([xTrain, yTrain, xTest]);
}

main().catch((err) => {
  console.error(`train-word-model: ${err.message}`);
  process.exit(1);
});
