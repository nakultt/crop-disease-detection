/**
 * The `model.json` manifest that ships next to `model.onnx`.
 *
 * Everything the client needs to run the model correctly lives here: input
 * size, normalisation constants, output names, CAM grid, and the class lists.
 * Nothing in this app hardcodes those values — if the exporter changes the
 * backbone or the label set, the UI follows without a code change.
 *
 * See `docs/MODEL_CONTRACT.md`.
 */

export interface ModelManifest {
  schemaVersion: number;
  modelVersion: string;
  backbone: string;
  /** `false` for `--demo` exports. The UI must warn loudly when this is false. */
  trained: boolean;
  precision: "fp32" | "fp16" | "int8";
  sizeBytes: number;
  input: {
    name: string;
    size: number;
    layout: "NCHW";
    mean: [number, number, number];
    std: [number, number, number];
  };
  outputs: {
    disease: string;
    severity: string;
    diseaseCam: string;
    severityCam: string;
  };
  cam: {
    grid: [number, number];
    /** `true` when CAM is algebraically exact for this architecture. */
    exact: boolean;
    method: string;
  };
  classes: {
    disease: string[];
    severity: string[];
  };
  severityRanges: Record<string, string>;
  metrics: {
    diseaseAccuracy: number;
    diseaseMacroF1: number;
    severityAccuracy: number;
    severityMacroF1: number;
    evaluatedOn: string;
    numSamples: number;
  } | null;
}

export const MODEL_BASE = "/models";
export const MANIFEST_URL = `${MODEL_BASE}/model.json`;
export const MODEL_URL = `${MODEL_BASE}/model.onnx`;

/**
 * The graph URL, stamped with the manifest's `modelVersion`.
 *
 * `model.onnx` is served `immutable` for a year, which is right for a 10 MB
 * file — but the path is identical from one export to the next. Without a
 * version in the query string a browser that cached an earlier export keeps
 * using it forever, silently pairing stale weights with a fresh manifest. That
 * shows up as a model that loads fine and predicts nonsense.
 *
 * The manifest itself is served `no-cache`, so it is always current, and a new
 * export therefore produces a URL the browser has never seen.
 */
export function modelUrlFor(manifest: ModelManifest): string {
  return `${MODEL_URL}?v=${encodeURIComponent(manifest.modelVersion)}`;
}

/** Thrown when the manifest is absent or unusable, with setup guidance. */
export class ManifestError extends Error {
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
    this.name = "ManifestError";
  }
}

const SETUP_HINT =
  "Run `uv run python main.py export --demo` in training/ to publish a model, " +
  "or `--verify` once you have a trained checkpoint.";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertTriple(value: unknown, field: string): [number, number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every(isFiniteNumber)
  ) {
    throw new ManifestError(
      `model.json: \`input.${field}\` must be three numbers.`,
      SETUP_HINT,
    );
  }
  return value as [number, number, number];
}

/**
 * Validate the shape of a parsed manifest.
 *
 * A malformed manifest silently produces garbage predictions — wrong
 * normalisation shifts every logit, a stale class list mislabels every
 * diagnosis — so this fails loudly rather than filling in defaults.
 */
export function parseManifest(raw: unknown): ModelManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new ManifestError("model.json is not a JSON object.", SETUP_HINT);
  }

  const m = raw as Partial<ModelManifest>;

  if (m.schemaVersion !== 1) {
    throw new ManifestError(
      `model.json declares schemaVersion ${String(m.schemaVersion)}; this build understands version 1.`,
      "Re-export with the current training pipeline.",
    );
  }

  if (!m.input || !isFiniteNumber(m.input.size) || m.input.size <= 0) {
    throw new ManifestError("model.json: `input.size` is missing.", SETUP_HINT);
  }

  const mean = assertTriple(m.input.mean, "mean");
  const std = assertTriple(m.input.std, "std");
  if (std.some((s) => s === 0)) {
    throw new ManifestError(
      "model.json: `input.std` contains a zero, which would divide by zero during preprocessing.",
      SETUP_HINT,
    );
  }

  const outputs = m.outputs;
  if (
    !outputs?.disease ||
    !outputs.severity ||
    !outputs.diseaseCam ||
    !outputs.severityCam
  ) {
    throw new ManifestError(
      "model.json: `outputs` must name all four graph outputs.",
      SETUP_HINT,
    );
  }

  const disease = m.classes?.disease;
  const severity = m.classes?.severity;
  if (!Array.isArray(disease) || disease.length === 0) {
    throw new ManifestError(
      "model.json: `classes.disease` is empty.",
      SETUP_HINT,
    );
  }
  if (!Array.isArray(severity) || severity.length === 0) {
    throw new ManifestError(
      "model.json: `classes.severity` is empty.",
      SETUP_HINT,
    );
  }

  return {
    schemaVersion: 1,
    modelVersion: m.modelVersion ?? "unknown",
    backbone: m.backbone ?? "unknown",
    trained: m.trained === true,
    precision: m.precision ?? "fp32",
    sizeBytes: isFiniteNumber(m.sizeBytes) ? m.sizeBytes : 0,
    input: {
      name: m.input.name ?? "input",
      size: m.input.size,
      layout: "NCHW",
      mean,
      std,
    },
    outputs,
    cam: {
      grid: (m.cam?.grid as [number, number]) ?? [8, 8],
      exact: m.cam?.exact === true,
      method: m.cam?.method ?? "CAM",
    },
    classes: { disease, severity },
    severityRanges: m.severityRanges ?? {},
    metrics: m.metrics ?? null,
  };
}

export async function fetchManifest(
  signal?: AbortSignal,
): Promise<ModelManifest> {
  let response: Response;
  try {
    response = await fetch(MANIFEST_URL, { signal, cache: "no-cache" });
  } catch {
    throw new ManifestError(
      "Could not reach model.json.",
      "Is the dev server running and serving pc/public/models/?",
    );
  }

  if (!response.ok) {
    throw new ManifestError(
      `model.json returned HTTP ${response.status}.`,
      SETUP_HINT,
    );
  }

  return parseManifest(await response.json());
}

/** "Tomato___Late_blight" → "Tomato · Late blight" */
export function displayName(className: string): string {
  const [crop, ...rest] = className.split("___");
  const condition = rest.join(" ").replace(/_/g, " ").trim();
  const cropName = crop
    .replace(/_/g, " ")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
  if (!condition) return cropName;
  const label = condition.charAt(0).toUpperCase() + condition.slice(1);
  return `${cropName} · ${label}`;
}

/** Just the crop, e.g. "Tomato". */
export function cropOf(className: string): string {
  return className
    .split("___")[0]
    .replace(/_/g, " ")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
}

/** Just the condition, e.g. "Late blight" or "Healthy". */
export function conditionOf(className: string): string {
  const rest = className
    .split("___")
    .slice(1)
    .join(" ")
    .replace(/_/g, " ")
    .trim();
  if (!rest) return "Unknown";
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export function isHealthy(className: string): boolean {
  return className.toLowerCase().includes("healthy");
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}
