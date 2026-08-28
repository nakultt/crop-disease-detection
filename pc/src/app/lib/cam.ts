/**
 * Rendering for class activation maps.
 *
 * The maps themselves come straight out of the ONNX graph — this module only
 * turns an `[h, w]` grid of activations into pixels: normalise, upscale
 * bilinearly, colour-map, composite.
 *
 * JET is deliberately absent. It is not perceptually uniform: its bands invent
 * edges that look like structure in the data and it collapses under greyscale
 * or common colour-vision deficiencies. The three maps here are all
 * perceptually uniform.
 */

export type ColormapName = "inferno" | "viridis" | "magma";

export const COLORMAP_NAMES: ColormapName[] = ["inferno", "viridis", "magma"];

/**
 * Anchor stops for each colormap, sampled from matplotlib's definitions.
 * Interpolated to 256 entries on first use and cached.
 */
const ANCHORS: Record<ColormapName, [number, number, number][]> = {
  inferno: [
    [0, 0, 4],
    [22, 11, 57],
    [66, 10, 104],
    [106, 23, 110],
    [147, 38, 103],
    [188, 55, 84],
    [221, 81, 58],
    [243, 120, 25],
    [252, 165, 10],
    [246, 215, 70],
    [252, 255, 164],
  ],
  viridis: [
    [68, 1, 84],
    [72, 36, 117],
    [65, 68, 135],
    [53, 95, 141],
    [42, 120, 142],
    [33, 145, 140],
    [34, 168, 132],
    [68, 191, 112],
    [122, 209, 81],
    [189, 223, 38],
    [253, 231, 37],
  ],
  magma: [
    [0, 0, 4],
    [20, 14, 54],
    [59, 15, 112],
    [100, 26, 128],
    [140, 41, 129],
    [180, 54, 122],
    [217, 72, 105],
    [242, 108, 93],
    [252, 152, 108],
    [254, 199, 141],
    [252, 253, 191],
  ],
};

const lutCache = new Map<ColormapName, Uint8ClampedArray>();

/** 256-entry RGB lookup table for a colormap. */
export function colormapLut(name: ColormapName): Uint8ClampedArray {
  const cached = lutCache.get(name);
  if (cached) return cached;

  const anchors = ANCHORS[name];
  const lut = new Uint8ClampedArray(256 * 3);
  const segments = anchors.length - 1;

  for (let i = 0; i < 256; i++) {
    const position = (i / 255) * segments;
    const index = Math.min(segments - 1, Math.floor(position));
    const t = position - index;
    const a = anchors[index];
    const b = anchors[index + 1];
    lut[i * 3] = a[0] + (b[0] - a[0]) * t;
    lut[i * 3 + 1] = a[1] + (b[1] - a[1]) * t;
    lut[i * 3 + 2] = a[2] + (b[2] - a[2]) * t;
  }

  lutCache.set(name, lut);
  return lut;
}

/**
 * ReLU + min-max normalise a raw CAM slice into `[0, 1]`.
 *
 * Negative activations are evidence *against* the class, which the heatmap does
 * not depict, so they clamp to zero. A perfectly flat map normalises to zero
 * rather than being amplified into noise by dividing by ~0.
 */
export function normalizeCam(values: Float32Array): Float32Array {
  const out = new Float32Array(values.length);
  let max = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] > 0 ? values[i] : 0;
    out[i] = v;
    if (v > max) max = v;
  }
  if (max < 1e-8) return out;
  for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
}

/**
 * Bilinearly resample an `[h, w]` grid to `[outH, outW]`.
 *
 * An 8x8 grid stretched to 256px with nearest-neighbour looks like a chessboard
 * and reads as false precision; bilinear keeps the map honest about how coarse
 * the underlying evidence is.
 */
export function upscaleBilinear(
  grid: Float32Array,
  h: number,
  w: number,
  outH: number,
  outW: number,
): Float32Array {
  const out = new Float32Array(outH * outW);
  // Map output pixel centres to input centres so edges are not biased.
  const scaleY = h / outH;
  const scaleX = w / outW;

  for (let y = 0; y < outH; y++) {
    const srcY = Math.min(h - 1, Math.max(0, (y + 0.5) * scaleY - 0.5));
    const y0 = Math.floor(srcY);
    const y1 = Math.min(h - 1, y0 + 1);
    const wy = srcY - y0;

    for (let x = 0; x < outW; x++) {
      const srcX = Math.min(w - 1, Math.max(0, (x + 0.5) * scaleX - 0.5));
      const x0 = Math.floor(srcX);
      const x1 = Math.min(w - 1, x0 + 1);
      const wx = srcX - x0;

      const top = grid[y0 * w + x0] * (1 - wx) + grid[y0 * w + x1] * wx;
      const bottom = grid[y1 * w + x0] * (1 - wx) + grid[y1 * w + x1] * wx;
      out[y * outW + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return out;
}

/**
 * Colour a normalised heatmap into RGBA pixels.
 *
 * Alpha ramps with intensity so cold regions stay transparent and the
 * photograph shows through, rather than veiling the whole leaf in purple.
 */
export function colorizeHeatmap(
  heat: Float32Array,
  width: number,
  height: number,
  colormap: ColormapName,
  opacity: number,
): ImageData {
  const lut = colormapLut(colormap);
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < heat.length; i++) {
    const v = heat[i] < 0 ? 0 : heat[i] > 1 ? 1 : heat[i];
    const index = (v * 255) | 0;
    rgba[i * 4] = lut[index * 3];
    rgba[i * 4 + 1] = lut[index * 3 + 1];
    rgba[i * 4 + 2] = lut[index * 3 + 2];
    // Ramp alpha from 0 at v=0 up to `opacity`, easing so the mid-range does
    // not wash out. v^0.7 keeps weak-but-real evidence visible.
    rgba[i * 4 + 3] = Math.round(255 * opacity * v ** 0.7);
  }

  return new ImageData(rgba, width, height);
}

/** Where the heat concentrates, in words, for the canvas `aria-label`. */
export function describeHotspot(
  grid: Float32Array,
  h: number,
  w: number,
): string {
  let best = -Infinity;
  let bestIndex = 0;
  let mass = 0;

  for (let i = 0; i < grid.length; i++) {
    mass += grid[i];
    if (grid[i] > best) {
      best = grid[i];
      bestIndex = i;
    }
  }

  if (mass < 1e-6) {
    return "The model did not concentrate on any particular region.";
  }

  const row = Math.floor(bestIndex / w);
  const col = bestIndex % w;
  const vertical =
    row < h / 3 ? "upper" : row < (2 * h) / 3 ? "middle" : "lower";
  const horizontal =
    col < w / 3 ? "left" : col < (2 * w) / 3 ? "centre" : "right";

  const band =
    vertical === "middle" && horizontal === "centre"
      ? "the centre"
      : `the ${vertical} ${horizontal}`;

  // How concentrated is the attention? Share of total activation in the top 25%.
  const sorted = Array.from(grid).sort((a, b) => b - a);
  const topQuarter = sorted
    .slice(0, Math.max(1, Math.floor(sorted.length / 4)))
    .reduce((sum, v) => sum + v, 0);
  const concentration = topQuarter / mass;

  const spread =
    concentration > 0.7
      ? "tightly focused on"
      : concentration > 0.5
        ? "focused on"
        : "spread broadly, leaning toward";

  return `Model attention is ${spread} ${band} of the leaf.`;
}

/**
 * Draw the source image with a heatmap composited over it.
 *
 * `heat` is the raw `[h, w]` CAM grid; upscaling happens here so callers never
 * need to know the feature-grid resolution.
 */
export function renderOverlay(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  heat: Float32Array,
  gridH: number,
  gridW: number,
  colormap: ColormapName,
  opacity: number,
): void {
  const { width, height } = canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx || width === 0 || height === 0) return;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  if (opacity <= 0) return;

  const upscaled = upscaleBilinear(heat, gridH, gridW, height, width);
  const overlay = colorizeHeatmap(upscaled, width, height, colormap, opacity);

  // Compose off-screen so the ImageData's alpha blends with the photo instead
  // of replacing it — putImageData ignores globalAlpha and overwrites pixels.
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return;
  layerCtx.putImageData(overlay, 0, 0);

  ctx.drawImage(layer, 0, 0);
}
