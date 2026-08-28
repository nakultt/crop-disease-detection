import { describe, expect, it } from "vitest";
import {
  conditionOf,
  cropOf,
  displayName,
  formatBytes,
  isHealthy,
  ManifestError,
  modelUrlFor,
  parseManifest,
} from "./manifest";

/** A manifest matching what `src.export_onnx` writes. */
function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    modelVersion: "2026-08-28T12:00:00Z",
    backbone: "mobilenetv4_conv_small.e2400_r224_in1k",
    trained: true,
    precision: "fp32",
    sizeBytes: 10171239,
    input: {
      name: "input",
      size: 256,
      layout: "NCHW",
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
    },
    outputs: {
      disease: "disease_logits",
      severity: "severity_logits",
      diseaseCam: "disease_cam",
      severityCam: "severity_cam",
    },
    cam: { grid: [8, 8], exact: true, method: "CAM" },
    classes: {
      disease: ["Tomato___Late_blight", "Tomato___healthy"],
      severity: ["Mild", "Moderate", "Severe", "Critical"],
    },
    severityRanges: { Mild: "0-25%" },
    metrics: null,
    ...overrides,
  };
}

describe("parseManifest", () => {
  it("accepts a well-formed manifest", () => {
    const manifest = parseManifest(validManifest());
    expect(manifest.input.size).toBe(256);
    expect(manifest.cam.exact).toBe(true);
    expect(manifest.classes.disease).toHaveLength(2);
  });

  it("rejects a future schema version instead of guessing", () => {
    expect(() => parseManifest(validManifest({ schemaVersion: 2 }))).toThrow(
      ManifestError,
    );
  });

  it("rejects a zero in std, which would divide by zero in preprocessing", () => {
    const bad = validManifest();
    bad.input.std = [0.229, 0, 0.225];
    expect(() => parseManifest(bad)).toThrow(/divide by zero/i);
  });

  it("rejects a mean that is not three channels", () => {
    const bad = validManifest();
    bad.input.mean = [0.485, 0.456] as unknown as number[];
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it("rejects a missing input size", () => {
    const bad = validManifest();
    delete (bad.input as Record<string, unknown>).size;
    expect(() => parseManifest(bad)).toThrow(/input\.size/);
  });

  it("rejects an incomplete outputs block", () => {
    const bad = validManifest();
    delete (bad.outputs as Record<string, unknown>).diseaseCam;
    expect(() => parseManifest(bad)).toThrow(/outputs/);
  });

  it("rejects an empty disease class list", () => {
    expect(() =>
      parseManifest(
        validManifest({ classes: { disease: [], severity: ["Mild"] } }),
      ),
    ).toThrow(/classes\.disease/);
  });

  it("rejects a non-object", () => {
    expect(() => parseManifest(null)).toThrow(ManifestError);
    expect(() => parseManifest("model.json")).toThrow(ManifestError);
  });

  it("carries a setup hint so the UI can tell the user what to run", () => {
    try {
      parseManifest(validManifest({ schemaVersion: 9 }));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestError);
      expect((error as ManifestError).hint).toBeTruthy();
    }
  });

  it("treats a missing `trained` flag as untrained", () => {
    // Defaulting to trusted would let an unlabelled artifact present noise as
    // a diagnosis with no warning banner.
    const bare = validManifest();
    delete (bare as Record<string, unknown>).trained;
    expect(parseManifest(bare).trained).toBe(false);
  });

  it("preserves trained:false from a demo export", () => {
    expect(parseManifest(validManifest({ trained: false })).trained).toBe(
      false,
    );
  });
});

describe("class name formatting", () => {
  it.each([
    ["Tomato___Late_blight", "Tomato", "Late blight"],
    ["Apple___Apple_scab", "Apple", "Apple scab"],
    ["Tomato___healthy", "Tomato", "Healthy"],
    ["Pepper,_bell___Bacterial_spot", "Pepper, bell", "Bacterial spot"],
  ])("%s splits into crop and condition", (className, crop, condition) => {
    expect(cropOf(className)).toBe(crop);
    expect(conditionOf(className)).toBe(condition);
  });

  it("strips the parenthetical from crop names", () => {
    expect(cropOf("Cherry_(including_sour)___Powdery_mildew")).toBe("Cherry");
    expect(cropOf("Corn_(maize)___Common_rust_")).toBe("Corn");
  });

  it("joins crop and condition for display", () => {
    expect(displayName("Tomato___Late_blight")).toBe("Tomato · Late blight");
  });

  it("never leaks the raw separator into display text", () => {
    for (const raw of [
      "Tomato___Late_blight",
      "Grape___Esca_(Black_Measles)",
      "Squash___Powdery_mildew",
    ]) {
      expect(displayName(raw)).not.toContain("___");
      expect(displayName(raw)).not.toContain("_");
    }
  });

  it("handles a name with no condition segment", () => {
    expect(displayName("Soybean")).toBe("Soybean");
    expect(conditionOf("Soybean")).toBe("Unknown");
  });
});

describe("isHealthy", () => {
  it.each(["Tomato___healthy", "Apple___healthy", "Soybean___healthy"])(
    "%s is healthy",
    (className) => expect(isHealthy(className)).toBe(true),
  );

  it.each(["Tomato___Late_blight", "Apple___Apple_scab"])(
    "%s is not healthy",
    (className) => expect(isHealthy(className)).toBe(false),
  );
});

describe("formatBytes", () => {
  it("uses MB above a megabyte", () => {
    expect(formatBytes(10171239)).toBe("9.7 MB");
  });

  it("uses KB below a megabyte", () => {
    expect(formatBytes(2351)).toBe("2 KB");
  });

  it("renders an em dash for an unknown size", () => {
    expect(formatBytes(0)).toBe("—");
  });
});

describe("modelUrlFor", () => {
  it("stamps the graph URL with the manifest version", () => {
    const manifest = parseManifest(validManifest());
    expect(modelUrlFor(manifest)).toBe(
      "/models/model.onnx?v=2026-08-28T12%3A00%3A00Z",
    );
  });

  it("changes when a new export changes modelVersion", () => {
    // model.onnx is served `immutable` for a year at a path that never moves.
    // Without a version in the query string a browser keeps stale weights
    // forever and pairs them with a fresh manifest -- the model loads fine and
    // predicts nonsense. This is the guard against that regression.
    const before = modelUrlFor(parseManifest(validManifest()));
    const after = modelUrlFor(
      parseManifest(validManifest({ modelVersion: "2026-09-01T00:00:00Z" })),
    );
    expect(after).not.toBe(before);
  });

  it("escapes characters that would break the query string", () => {
    const url = modelUrlFor(
      parseManifest(
        validManifest({ modelVersion: "2026-08-28T09:50:00+00:00" }),
      ),
    );
    expect(url).not.toContain("+00:00");
    expect(url).toContain("%2B00%3A00");
  });
});
