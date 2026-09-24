import { describe, expect, it } from "vitest";
import { scanMetaSchema } from "@/app/lib/scan-contract";
import { camBuffers, shippedManifest, validMeta } from "@/test/fixtures";
import {
  buildScanQuery,
  ScanValidationError,
  startOfIsoWeek,
  validateAgainstManifest,
} from "./scans";

const manifest = shippedManifest();

function check(
  overrides: Parameters<typeof validMeta>[1] = {},
  buffers?: ReturnType<typeof camBuffers>,
) {
  const meta = scanMetaSchema.parse(validMeta(manifest, overrides));
  validateAgainstManifest(meta, manifest, buffers ?? camBuffers(meta));
}

describe("validateAgainstManifest", () => {
  it("accepts a result the deployed model could have produced", () => {
    expect(() => check()).not.toThrow();
  });

  it("rejects a class name at the wrong index — a stale model on the client", () => {
    expect(() =>
      check({
        disease: {
          className: "Tomato___Early_blight",
          index: 0,
          probability: 0.9,
        },
      }),
    ).toThrowError(expect.objectContaining({ code: "model_mismatch" }));
  });

  it("rejects an unknown severity level", () => {
    const meta = validMeta(manifest);
    expect(() =>
      check({ severity: { ...meta.severity, className: "Apocalyptic" } }),
    ).toThrow(ScanValidationError);
  });

  it("rejects activation maps of the wrong size", () => {
    const meta = scanMetaSchema.parse(validMeta(manifest));
    const buffers = camBuffers(meta);
    expect(() =>
      validateAgainstManifest(meta, manifest, {
        ...buffers,
        diseaseCam: buffers.diseaseCam.subarray(4),
      }),
    ).toThrow(/wrong size/);
  });

  it("rejects NaN or infinite activations", () => {
    const meta = scanMetaSchema.parse(validMeta(manifest));
    const buffers = camBuffers(meta);
    const poisoned = new Float32Array(buffers.severityCam.buffer.slice(0));
    poisoned[3] = Number.NaN;
    expect(() =>
      validateAgainstManifest(meta, manifest, {
        ...buffers,
        severityCam: Buffer.from(poisoned.buffer),
      }),
    ).toThrow(/invalid values/);
  });
});

describe("buildScanQuery", () => {
  it("always scopes to the user", () => {
    expect(buildScanQuery("u1", { status: "all" })).toEqual({ userId: "u1" });
  });

  it("combines filters, and severity implies diseased", () => {
    expect(
      buildScanQuery("u1", {
        status: "all",
        crop: "Tomato",
        severity: "Severe",
      }),
    ).toEqual({
      userId: "u1",
      "disease.crop": "Tomato",
      "severity.className": "Severe",
      "disease.healthy": false,
    });
  });

  it("escapes regex syntax in free-text search", () => {
    const query = buildScanQuery("u1", { status: "all", q: "a.*(b" });
    const pattern = (query.$or?.[0] as { label: RegExp }).label;
    expect(pattern.test("a.*(b")).toBe(true);
    expect(pattern.test("aXXb")).toBe(false);
  });
});

describe("startOfIsoWeek", () => {
  it("returns Monday 00:00 UTC", () => {
    expect(startOfIsoWeek(new Date("2026-09-24T15:00:00Z")).toISOString()).toBe(
      "2026-09-21T00:00:00.000Z",
    );
    expect(startOfIsoWeek(new Date("2026-09-27T23:59:59Z")).toISOString()).toBe(
      "2026-09-21T00:00:00.000Z",
    );
    expect(startOfIsoWeek(new Date("2026-09-21T00:00:00Z")).toISOString()).toBe(
      "2026-09-21T00:00:00.000Z",
    );
  });
});
