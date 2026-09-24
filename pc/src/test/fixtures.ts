import { readFileSync } from "node:fs";
import path from "node:path";
import { type ModelManifest, parseManifest } from "@/app/lib/manifest";
import type { ScanMetaInput } from "@/app/lib/scan-contract";

/** The model manifest the app actually ships. */
export function shippedManifest(): ModelManifest {
  const file = path.resolve(__dirname, "../../public/models/model.json");
  return parseManifest(JSON.parse(readFileSync(file, "utf8")));
}

const score = (className: string, index: number, probability: number) => ({
  className,
  index,
  probability,
});

/**
 * A plausible scan payload, consistent with the shipped manifest: every
 * class sits at the index the model gives it.
 */
export function validMeta(
  manifest: ModelManifest = shippedManifest(),
  overrides: Partial<ScanMetaInput> = {},
): ScanMetaInput {
  const disease = manifest.classes.disease;
  const severity = manifest.classes.severity;
  const at = (name: string) => disease.indexOf(name);

  return {
    fileName: "leaf.jpg",
    disease: score("Tomato___Early_blight", at("Tomato___Early_blight"), 0.97),
    topK: [
      score("Tomato___Early_blight", at("Tomato___Early_blight"), 0.97),
      score("Tomato___Late_blight", at("Tomato___Late_blight"), 0.02),
    ],
    severity: {
      ...score(severity[1], 1, 0.6),
      range: "26–50%",
      distribution: severity.map((name, i) =>
        score(name, i, [0.2, 0.6, 0.15, 0.05][i] ?? 0),
      ),
    },
    cam: { gridH: 8, gridW: 8, classes: disease.length },
    model: {
      version: manifest.modelVersion,
      backbone: manifest.backbone,
      trained: true,
    },
    inferenceMs: 48.2,
    image: { width: 1200, height: 900 },
    ...overrides,
  };
}

/** CAM buffers of the right size for `meta`. */
export function camBuffers(meta: ScanMetaInput) {
  const plane = meta.cam.gridH * meta.cam.gridW;
  const disease = new Float32Array(meta.cam.classes * plane).map(
    (_, i) => (i % 7) / 7,
  );
  const severity = new Float32Array(plane).map((_, i) => (i % 3) / 3);
  return {
    diseaseCam: Buffer.from(disease.buffer),
    severityCam: Buffer.from(severity.buffer),
  };
}

/** A minimal valid JPEG (1×1). */
export const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=",
  "base64",
);
