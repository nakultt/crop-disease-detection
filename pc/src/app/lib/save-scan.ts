/**
 * Saving an on-device analysis to the user's history.
 *
 * The photo is re-encoded through a canvas before upload. Besides shrinking it
 * to a sensible size, that drops every byte of EXIF metadata — including the
 * GPS coordinates phones embed — so a saved scan never reveals where a farm is.
 */

import type { PredictionResult } from "./inference";
import type { ModelManifest } from "./manifest";
import { SCAN_LIMITS, type ScanMetaInput } from "./scan-contract";

export class SaveScanError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "SaveScanError";
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the image.")),
      "image/jpeg",
      quality,
    );
  });
}

/** Encode at decreasing quality until the result fits `maxBytes`. */
async function encodeWithin(
  canvas: HTMLCanvasElement,
  maxBytes: number,
): Promise<Blob> {
  for (const quality of [0.85, 0.72, 0.6, 0.45]) {
    const blob = await toBlob(canvas, quality);
    if (blob.size <= maxBytes) return blob;
  }
  throw new Error("The photo is too detailed to store.");
}

export interface EncodedPhoto {
  image: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export async function encodePhoto(
  source: HTMLImageElement,
): Promise<EncodedPhoto> {
  const { naturalWidth: w, naturalHeight: h } = source;

  const scale = Math.min(1, SCAN_LIMITS.imageMaxEdge / Math.max(w, h));
  const full = document.createElement("canvas");
  full.width = Math.max(1, Math.round(w * scale));
  full.height = Math.max(1, Math.round(h * scale));
  const fullCtx = full.getContext("2d");
  if (!fullCtx) throw new Error("Could not acquire a 2D canvas context.");
  fullCtx.imageSmoothingQuality = "high";
  fullCtx.drawImage(source, 0, 0, full.width, full.height);

  // The thumbnail is the centre square — the same crop the model analysed.
  const side = Math.min(w, h);
  const thumb = document.createElement("canvas");
  thumb.width = SCAN_LIMITS.thumbSize;
  thumb.height = SCAN_LIMITS.thumbSize;
  const thumbCtx = thumb.getContext("2d");
  if (!thumbCtx) throw new Error("Could not acquire a 2D canvas context.");
  thumbCtx.imageSmoothingQuality = "high";
  thumbCtx.drawImage(
    source,
    (w - side) / 2,
    (h - side) / 2,
    side,
    side,
    0,
    0,
    thumb.width,
    thumb.height,
  );

  return {
    image: await encodeWithin(full, SCAN_LIMITS.imageMaxBytes),
    thumb: await encodeWithin(thumb, SCAN_LIMITS.thumbMaxBytes),
    width: full.width,
    height: full.height,
  };
}

export function scanMeta(
  result: PredictionResult,
  manifest: ModelManifest,
  fileName: string,
  photo: EncodedPhoto | null,
): ScanMetaInput {
  const score = (s: {
    className: string;
    index: number;
    probability: number;
  }) => ({
    className: s.className,
    index: s.index,
    probability: s.probability,
  });

  return {
    fileName: fileName.slice(0, 255),
    disease: score(result.disease),
    topK: result.disease.topK.map(score),
    severity: {
      ...score(result.severity),
      range: result.severity.range,
      distribution: result.severity.distribution.map(score),
    },
    cam: {
      gridH: result.gridH,
      gridW: result.gridW,
      classes: manifest.classes.disease.length,
    },
    model: {
      version: manifest.modelVersion,
      backbone: manifest.backbone,
      trained: manifest.trained,
    },
    inferenceMs: Math.round(result.inferenceMs * 10) / 10,
    image: photo ? { width: photo.width, height: photo.height } : null,
  };
}

/** Upload one analysis. Resolves to the new scan's id. */
export async function saveScan(args: {
  result: PredictionResult;
  manifest: ModelManifest;
  fileName: string;
  image: HTMLImageElement;
  includePhoto: boolean;
}): Promise<string> {
  const photo = args.includePhoto ? await encodePhoto(args.image) : null;

  const form = new FormData();
  form.set(
    "meta",
    JSON.stringify(scanMeta(args.result, args.manifest, args.fileName, photo)),
  );
  // Copies are backed by a plain ArrayBuffer, which is what Blob accepts.
  form.set(
    "diseaseCam",
    new Blob([new Float32Array(args.result.diseaseCamCube)]),
  );
  form.set(
    "severityCam",
    new Blob([new Float32Array(args.result.severityCam)]),
  );
  if (photo) {
    form.set("image", photo.image, "photo.jpg");
    form.set("thumb", photo.thumb, "thumb.jpg");
  }

  const response = await fetch("/api/scans", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new SaveScanError(
      body?.error?.message ?? `Saving failed (HTTP ${response.status}).`,
      response.status,
      body?.error?.code ?? "unknown",
    );
  }

  const { id } = (await response.json()) as { id: string };
  return id;
}
