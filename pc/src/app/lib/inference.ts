/**
 * In-browser inference with ONNX Runtime Web.
 *
 * Everything runs on the visitor's device: the leaf photograph is never
 * uploaded anywhere. The model is fetched once, cached by the browser, and
 * executed through the WASM backend.
 */

import * as ort from "onnxruntime-web";
import {
  fetchManifest,
  isHealthy,
  type ModelManifest,
  modelUrlFor,
} from "./manifest";

export interface ClassScore {
  className: string;
  index: number;
  probability: number;
}

export interface PredictionResult {
  disease: ClassScore & { healthy: boolean; topK: ClassScore[] };
  severity: ClassScore & { range: string; distribution: ClassScore[] };
  /**
   * The full disease CAM cube, `[numDiseaseClasses * gridH * gridW]`.
   *
   * Kept whole rather than sliced to the winner so the UI can explain any
   * candidate the user selects without re-running the model. At 38x8x8 this is
   * about 10 KB, so retaining it is cheaper than a second inference pass.
   */
  diseaseCamCube: Float32Array;
  /** Raw CAM grid for the predicted severity level, `[gridH * gridW]`. */
  severityCam: Float32Array;
  gridH: number;
  gridW: number;
  /** Wall-clock time for `session.run`, in milliseconds. */
  inferenceMs: number;
}

export interface LoadProgress {
  loadedBytes: number;
  totalBytes: number;
  phase: "manifest" | "download" | "compile" | "ready";
}

let manifestPromise: Promise<ModelManifest> | null = null;
let sessionPromise: Promise<ort.InferenceSession> | null = null;

/**
 * Multi-threaded WASM needs `SharedArrayBuffer`, which the browser only exposes
 * on a cross-origin-isolated page. `next.config.ts` sends COOP/COEP to enable
 * it, but isolation can still fail (an embedded context, an older browser), so
 * read the actual capability rather than assuming.
 */
function configureRuntime(): void {
  const isolated =
    typeof globalThis !== "undefined" &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated ===
      true;

  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;

  ort.env.wasm.numThreads = isolated ? Math.min(4, Math.max(1, cores - 1)) : 1;
  ort.env.wasm.simd = true;
  ort.env.logLevel = "error";
}

export function getManifest(): Promise<ModelManifest> {
  manifestPromise ??= fetchManifest();
  return manifestPromise;
}

/** Whether the WASM backend ended up single- or multi-threaded. */
export function backendLabel(): string {
  const threads = ort.env.wasm.numThreads ?? 1;
  return threads > 1 ? `WASM · ${threads} threads` : "WASM · 1 thread";
}

/**
 * Download the model with byte-level progress, then build the ORT session.
 *
 * A plain `InferenceSession.create(url)` gives no feedback while tens of
 * megabytes stream in, which reads as a hung page. Streaming the response
 * ourselves lets the UI show a real progress bar.
 */
async function createSession(
  onProgress?: (progress: LoadProgress) => void,
): Promise<ort.InferenceSession> {
  configureRuntime();

  onProgress?.({ loadedBytes: 0, totalBytes: 0, phase: "manifest" });
  const manifest = await getManifest();

  // Versioned URL: a new export changes `modelVersion`, so the browser cannot
  // serve stale weights alongside a fresh manifest. See `modelUrlFor`.
  const response = await fetch(modelUrlFor(manifest), { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(
      `model.onnx returned HTTP ${response.status}. Export a model from training/ first.`,
    );
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  const totalBytes = declared || manifest.sizeBytes;

  let buffer: ArrayBuffer;
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loadedBytes = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loadedBytes += value.length;
      onProgress?.({ loadedBytes, totalBytes, phase: "download" });
    }

    const merged = new Uint8Array(loadedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    buffer = merged.buffer;
  } else {
    buffer = await response.arrayBuffer();
  }

  onProgress?.({ loadedBytes: totalBytes, totalBytes, phase: "compile" });

  const session = await ort.InferenceSession.create(buffer, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  const missing = Object.values(manifest.outputs).filter(
    (name) => !session.outputNames.includes(name),
  );
  if (missing.length > 0) {
    throw new Error(
      `model.onnx is missing the outputs its manifest promises: ${missing.join(", ")}. ` +
        "The .onnx and .json files are out of sync — re-export both together.",
    );
  }

  onProgress?.({ loadedBytes: totalBytes, totalBytes, phase: "ready" });
  return session;
}

export function loadModel(
  onProgress?: (progress: LoadProgress) => void,
): Promise<ort.InferenceSession> {
  sessionPromise ??= createSession(onProgress).catch((error) => {
    // Do not cache a failed load — the next attempt should retry from scratch.
    sessionPromise = null;
    throw error;
  });
  return sessionPromise;
}

/**
 * Resize short-side-to-`size` then centre-crop, matching the training
 * transform. Squashing a non-square photo to a square distorts leaf geometry
 * and measurably shifts predictions, so aspect ratio is preserved.
 */
export function preprocess(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  manifest: ModelManifest,
): { tensor: ort.Tensor; canvas: HTMLCanvasElement } {
  const size = manifest.input.size;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not acquire a 2D canvas context.");

  const scale = size / Math.min(sourceWidth, sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(
    source,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  const { data } = ctx.getImageData(0, 0, size, size);
  const [meanR, meanG, meanB] = manifest.input.mean;
  const [stdR, stdG, stdB] = manifest.input.std;

  // NCHW: a full R plane, then G, then B.
  const plane = size * size;
  const tensorData = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    tensorData[i] = (data[p] / 255 - meanR) / stdR;
    tensorData[plane + i] = (data[p + 1] / 255 - meanG) / stdG;
    tensorData[2 * plane + i] = (data[p + 2] / 255 - meanB) / stdB;
  }

  return {
    tensor: new ort.Tensor("float32", tensorData, [1, 3, size, size]),
    canvas,
  };
}

/** Numerically stable softmax. */
export function softmax(logits: Float32Array): Float32Array {
  const out = new Float32Array(logits.length);
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;

  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] - max);
    out[i] = e;
    sum += e;
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

function argmax(values: Float32Array): number {
  let best = 0;
  for (let i = 1; i < values.length; i++)
    if (values[i] > values[best]) best = i;
  return best;
}

/** Extract `cam[0, classIndex]` from a `[1, K, h, w]` tensor. */
function camSlice(
  data: Float32Array,
  classIndex: number,
  gridH: number,
  gridW: number,
): Float32Array {
  const stride = gridH * gridW;
  return data.slice(classIndex * stride, (classIndex + 1) * stride);
}

export async function predict(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<{ result: PredictionResult; input: HTMLCanvasElement }> {
  const manifest = await getManifest();
  const session = await loadModel();
  const { tensor, canvas } = preprocess(
    source,
    sourceWidth,
    sourceHeight,
    manifest,
  );

  const started = performance.now();
  const outputs = await session.run({ [manifest.input.name]: tensor });
  const inferenceMs = performance.now() - started;

  const diseaseLogits = outputs[manifest.outputs.disease].data as Float32Array;
  const severityLogits = outputs[manifest.outputs.severity]
    .data as Float32Array;
  const diseaseCamTensor = outputs[manifest.outputs.diseaseCam];
  const severityCamTensor = outputs[manifest.outputs.severityCam];

  // Read the grid off the tensor rather than trusting the manifest, so a
  // mismatch surfaces as a wrong-looking heatmap rather than a buffer overrun.
  const dims = diseaseCamTensor.dims;
  const gridH = Number(dims[dims.length - 2]);
  const gridW = Number(dims[dims.length - 1]);

  const diseaseProbabilities = softmax(diseaseLogits);
  const severityProbabilities = softmax(severityLogits);

  const diseaseIndex = argmax(diseaseProbabilities);
  const severityIndex = argmax(severityProbabilities);

  const diseaseNames = manifest.classes.disease;
  const severityNames = manifest.classes.severity;

  const topK: ClassScore[] = Array.from(diseaseProbabilities)
    .map((probability, index) => ({
      className: diseaseNames[index] ?? `class_${index}`,
      index,
      probability,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  const distribution: ClassScore[] = Array.from(severityProbabilities).map(
    (probability, index) => ({
      className: severityNames[index] ?? `level_${index}`,
      index,
      probability,
    }),
  );

  const severityName = severityNames[severityIndex] ?? `level_${severityIndex}`;

  return {
    input: canvas,
    result: {
      disease: {
        className: diseaseNames[diseaseIndex] ?? `class_${diseaseIndex}`,
        index: diseaseIndex,
        probability: diseaseProbabilities[diseaseIndex],
        healthy: isHealthy(diseaseNames[diseaseIndex] ?? ""),
        topK,
      },
      severity: {
        className: severityName,
        index: severityIndex,
        probability: severityProbabilities[severityIndex],
        range: manifest.severityRanges[severityName] ?? "",
        distribution,
      },
      // Copy out of the ORT-owned buffer: the tensor's memory can be reused
      // once the next run starts, which would silently corrupt a retained view.
      diseaseCamCube: Float32Array.from(diseaseCamTensor.data as Float32Array),
      severityCam: camSlice(
        severityCamTensor.data as Float32Array,
        severityIndex,
        gridH,
        gridW,
      ),
      gridH,
      gridW,
      inferenceMs,
    },
  };
}

/**
 * The activation map for one class, taken from the cube captured at inference.
 *
 * Selecting a runner-up in the UI must show *that* class's evidence; returning
 * the winner's map regardless would quietly make the explanation a lie.
 */
export function camForClass(
  result: PredictionResult,
  classIndex: number,
): Float32Array {
  const stride = result.gridH * result.gridW;
  const start = classIndex * stride;
  if (start < 0 || start + stride > result.diseaseCamCube.length) {
    return result.diseaseCamCube.slice(
      result.disease.index * stride,
      (result.disease.index + 1) * stride,
    );
  }
  return result.diseaseCamCube.slice(start, start + stride);
}
