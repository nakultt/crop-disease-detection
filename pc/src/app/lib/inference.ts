/**
 * ONNX Runtime Web inference engine.
 *
 * Loads the MobileNetV5 multi-task model and runs inference entirely
 * in the browser using WebAssembly (WASM) backend.
 */

import * as ort from "onnxruntime-web";
import { DISEASE_CLASSES, SEVERITY_CLASSES } from "./labels";

// Configure ONNX Runtime
ort.env.wasm.numThreads = 4;

export interface PredictionResult {
  disease: {
    className: string;
    index: number;
    confidence: number;
    topK: Array<{ className: string; index: number; confidence: number }>;
  };
  severity: {
    level: string;
    index: number;
    confidence: number;
    distribution: Array<{ level: string; confidence: number }>;
  };
}

let session: ort.InferenceSession | null = null;
let isLoading = false;

/**
 * Load the ONNX model. Caches the session for subsequent calls.
 */
export async function loadModel(): Promise<ort.InferenceSession> {
  if (session) return session;
  if (isLoading) {
    // Wait for in-progress load
    while (isLoading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (session) return session;
  }

  isLoading = true;
  try {
    console.log("Loading ONNX model...");
    const modelUrl = "/models/model.onnx";

    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });

    console.log("Model loaded successfully");
    console.log("Input names:", session.inputNames);
    console.log("Output names:", session.outputNames);

    return session;
  } finally {
    isLoading = false;
  }
}

/**
 * Preprocess an image for MobileNetV5 inference.
 * Resizes to 256x256 and normalizes with ImageNet statistics.
 */
export function preprocessImage(
  imageElement: HTMLImageElement | HTMLCanvasElement
): ort.Tensor {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(imageElement, 0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const { data } = imageData;

  // ImageNet normalization
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  // Convert to NCHW float32 tensor
  const float32Data = new Float32Array(3 * size * size);

  for (let c = 0; c < 3; c++) {
    for (let h = 0; h < size; h++) {
      for (let w = 0; w < size; w++) {
        const pixelIndex = (h * size + w) * 4;
        const tensorIndex = c * size * size + h * size + w;
        float32Data[tensorIndex] =
          (data[pixelIndex + c] / 255.0 - mean[c]) / std[c];
      }
    }
  }

  return new ort.Tensor("float32", float32Data, [1, 3, size, size]);
}

/**
 * Apply softmax to an array of logits.
 */
function softmax(logits: Float32Array | number[]): number[] {
  const maxVal = Math.max(...logits);
  const exps = Array.from(logits).map((v) => Math.exp(v - maxVal));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sumExps);
}

/**
 * Run inference on an image element.
 */
export async function predict(
  imageElement: HTMLImageElement | HTMLCanvasElement
): Promise<PredictionResult> {
  const sess = await loadModel();
  const inputTensor = preprocessImage(imageElement);

  const feeds: Record<string, ort.Tensor> = {};
  feeds[sess.inputNames[0]] = inputTensor;

  const results = await sess.run(feeds);

  // Parse disease output
  const diseaseOutput = results[sess.outputNames[0]];
  const diseaseLogits = diseaseOutput.data as Float32Array;
  const diseaseProbs = softmax(diseaseLogits);

  const diseaseIndex = diseaseProbs.indexOf(Math.max(...diseaseProbs));

  // Top-K disease predictions
  const topK = diseaseProbs
    .map((conf, idx) => ({
      className: DISEASE_CLASSES[idx],
      index: idx,
      confidence: conf,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  // Parse severity output
  const severityOutput = results[sess.outputNames[1]];
  const severityLogits = severityOutput.data as Float32Array;
  const severityProbs = softmax(severityLogits);

  const severityIndex = severityProbs.indexOf(Math.max(...severityProbs));

  const distribution = severityProbs.map((conf, idx) => ({
    level: SEVERITY_CLASSES[idx],
    confidence: conf,
  }));

  return {
    disease: {
      className: DISEASE_CLASSES[diseaseIndex],
      index: diseaseIndex,
      confidence: diseaseProbs[diseaseIndex],
      topK,
    },
    severity: {
      level: SEVERITY_CLASSES[severityIndex],
      index: severityIndex,
      confidence: severityProbs[severityIndex],
      distribution,
    },
  };
}

/**
 * Check if the model file exists and is loadable.
 */
export async function isModelAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/models/model.onnx", { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}
