import { describe, expect, it } from "vitest";
import { validMeta as fixture } from "@/test/fixtures";
import {
  base64ToFloats,
  floatsToBase64,
  type ScanMetaInput,
  scanFiltersSchema,
  scanMetaSchema,
  scanUpdateSchema,
} from "./scan-contract";

const score = (className: string, index: number, probability: number) => ({
  className,
  index,
  probability,
});

const validMeta = (overrides: Partial<ScanMetaInput> = {}) =>
  fixture(undefined, overrides);

describe("scanMetaSchema", () => {
  it("accepts a well-formed result and fills defaults", () => {
    const parsed = scanMetaSchema.parse(validMeta());
    expect(parsed.label).toBe("");
    expect(parsed.notes).toBe("");
  });

  it("rejects probabilities outside [0, 1]", () => {
    expect(
      scanMetaSchema.safeParse(validMeta({ disease: score("X", 1, 1.5) }))
        .success,
    ).toBe(false);
  });

  it("rejects an absurd CAM grid", () => {
    expect(
      scanMetaSchema.safeParse(
        validMeta({ cam: { gridH: 500, gridW: 8, classes: 38 } }),
      ).success,
    ).toBe(false);
  });

  it("trims and bounds free text", () => {
    const parsed = scanMetaSchema.parse(
      validMeta({ label: "  North field  " }),
    );
    expect(parsed.label).toBe("North field");
    expect(
      scanMetaSchema.safeParse(validMeta({ notes: "x".repeat(5000) })).success,
    ).toBe(false);
  });
});

describe("scanUpdateSchema", () => {
  it("needs at least one field", () => {
    expect(scanUpdateSchema.safeParse({}).success).toBe(false);
    expect(scanUpdateSchema.safeParse({ notes: "sprayed" }).success).toBe(true);
  });
});

describe("scanFiltersSchema", () => {
  it("defaults everything", () => {
    expect(scanFiltersSchema.parse({})).toMatchObject({
      status: "all",
      sort: "newest",
      page: 1,
    });
  });

  it("falls back instead of failing on garbage from the URL", () => {
    const parsed = scanFiltersSchema.parse({
      status: "weird",
      sort: "sideways",
      page: "-4",
    });
    expect(parsed).toMatchObject({ status: "all", sort: "newest", page: 1 });
  });
});

describe("float encoding", () => {
  it("round-trips a Float32Array through base64", () => {
    const values = Float32Array.from([0, 1.5, -2.25, 3.4e-8, 1e6]);
    expect(Array.from(base64ToFloats(floatsToBase64(values)))).toEqual(
      Array.from(values),
    );
  });
});
