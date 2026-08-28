import { describe, expect, it } from "vitest";
import {
  COLORMAP_NAMES,
  colormapLut,
  describeHotspot,
  normalizeCam,
  upscaleBilinear,
} from "./cam";

/** Build an `[h, w]` grid from a nested array, row-major. */
function grid(rows: number[][]): Float32Array {
  return Float32Array.from(rows.flat());
}

describe("normalizeCam", () => {
  it("scales the peak to 1", () => {
    const out = normalizeCam(Float32Array.from([1, 2, 4]));
    expect(Array.from(out)).toEqual([0.25, 0.5, 1]);
  });

  it("clamps negative activations to zero", () => {
    // Negative activation is evidence *against* the class. Showing it as heat
    // would invert the meaning of the map.
    const out = normalizeCam(Float32Array.from([-5, 0, 2]));
    expect(Array.from(out)).toEqual([0, 0, 1]);
  });

  it("returns all zeros for an all-negative map rather than amplifying noise", () => {
    const out = normalizeCam(Float32Array.from([-3, -2, -1]));
    expect(Array.from(out)).toEqual([0, 0, 0]);
  });

  it("returns all zeros for a flat map instead of dividing by ~zero", () => {
    const out = normalizeCam(new Float32Array(16));
    expect(Array.from(out).every((v) => v === 0)).toBe(true);
  });

  it("never emits a value outside [0, 1]", () => {
    const input = Float32Array.from([-100, -1, 0, 0.5, 3, 1e6]);
    for (const v of normalizeCam(input)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("does not mutate its input", () => {
    const input = Float32Array.from([-1, 2, 4]);
    normalizeCam(input);
    expect(Array.from(input)).toEqual([-1, 2, 4]);
  });
});

describe("upscaleBilinear", () => {
  it("returns the requested output size", () => {
    const out = upscaleBilinear(new Float32Array(64), 8, 8, 256, 256);
    expect(out.length).toBe(256 * 256);
  });

  it("preserves a constant field exactly", () => {
    const flat = new Float32Array(16).fill(0.42);
    const out = upscaleBilinear(flat, 4, 4, 32, 32);
    for (const v of out) expect(v).toBeCloseTo(0.42, 6);
  });

  it("is an identity when the size is unchanged", () => {
    const source = grid([
      [0, 1],
      [2, 3],
    ]);
    const out = upscaleBilinear(source, 2, 2, 2, 2);
    expect(Array.from(out)).toEqual([0, 1, 2, 3]);
  });

  it("interpolates rather than replicating, so 8x8 does not look blocky", () => {
    // A hard 0/1 edge upscaled 2x must produce intermediate values; nearest
    // neighbour would emit only 0s and 1s.
    const source = grid([
      [0, 1],
      [0, 1],
    ]);
    const out = upscaleBilinear(source, 2, 2, 4, 4);
    const values = new Set(Array.from(out).map((v) => v.toFixed(3)));
    expect(values.size).toBeGreaterThan(2);
  });

  it("keeps output within the input's range (no overshoot)", () => {
    const source = grid([
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ]);
    const out = upscaleBilinear(source, 3, 3, 40, 40);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the hot corner in the same corner", () => {
    // A map whose peak drifts under upscaling would point the user at the
    // wrong part of the leaf.
    const source = grid([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
    ]);
    const size = 30;
    const out = upscaleBilinear(source, 3, 3, size, size);

    let bestIndex = 0;
    for (let i = 1; i < out.length; i++)
      if (out[i] > out[bestIndex]) bestIndex = i;

    const row = Math.floor(bestIndex / size);
    const column = bestIndex % size;
    expect(row).toBeGreaterThan(size / 2);
    expect(column).toBeGreaterThan(size / 2);
  });
});

describe("colormapLut", () => {
  it.each(COLORMAP_NAMES)("%s has 256 RGB entries", (name) => {
    expect(colormapLut(name).length).toBe(256 * 3);
  });

  it.each(COLORMAP_NAMES)("%s stays within byte range", (name) => {
    for (const channel of colormapLut(name)) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });

  it.each(COLORMAP_NAMES)("%s ramps dark to bright", (name) => {
    const lut = colormapLut(name);
    const luminance = (i: number) =>
      0.2126 * lut[i * 3] + 0.7152 * lut[i * 3 + 1] + 0.0722 * lut[i * 3 + 2];
    expect(luminance(255)).toBeGreaterThan(luminance(0));
  });

  it("returns a cached instance on repeat calls", () => {
    expect(colormapLut("inferno")).toBe(colormapLut("inferno"));
  });

  it("does not offer JET", () => {
    // JET is not perceptually uniform; its bands invent edges that read as
    // structure in the data.
    expect(COLORMAP_NAMES).not.toContain("jet" as never);
  });
});

describe("describeHotspot", () => {
  const hotAt = (row: number, column: number, size = 9) => {
    const g = new Float32Array(size * size);
    g[row * size + column] = 1;
    return g;
  };

  it("names the upper left", () => {
    expect(describeHotspot(hotAt(0, 0), 9, 9)).toContain("upper left");
  });

  it("names the lower right", () => {
    expect(describeHotspot(hotAt(8, 8), 9, 9)).toContain("lower right");
  });

  it("calls the middle-centre cell simply the centre", () => {
    const description = describeHotspot(hotAt(4, 4), 9, 9);
    expect(description).toContain("the centre");
    expect(description).not.toContain("middle centre");
  });

  it("says nothing stood out when the map is empty", () => {
    expect(describeHotspot(new Float32Array(64), 8, 8)).toContain(
      "did not concentrate",
    );
  });

  it("reports a single spike as tightly focused", () => {
    expect(describeHotspot(hotAt(1, 7), 9, 9)).toContain("tightly focused");
  });

  it("reports a uniform map as spread broadly", () => {
    const flat = new Float32Array(64).fill(0.5);
    expect(describeHotspot(flat, 8, 8)).toContain("spread broadly");
  });
});
