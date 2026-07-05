/**
 * Client-side Grad-CAM approximation.
 *
 * Since true Grad-CAM requires gradient computation (not available in ONNX Runtime Web),
 * we implement a simplified attention-based heatmap using the input image's color channels
 * to highlight diseased regions (similar to the training pipeline's severity estimation).
 *
 * For full Grad-CAM, a separate ONNX model exporting intermediate activations would be needed.
 * This provides a visually useful approximation that highlights regions of interest.
 */

/**
 * Generate a heatmap highlighting potentially diseased regions.
 *
 * Uses HSV color analysis similar to the training pipeline's severity estimation:
 * - Green regions = healthy (low heat)
 * - Brown/yellow/dark regions = diseased (high heat)
 */
export function generateHeatmap(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  width: number = 256,
  height: number = 256
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(imageElement, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  const heatmap = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Convert to HSV
    let h = 0;
    const s = max === 0 ? 0 : delta / max;
    const v = max;

    if (delta > 0) {
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
      if (h < 0) h += 360;
    }

    // Score: higher = more likely diseased
    let score = 0;

    // Background detection (low saturation + high/low value)
    const isBackground = s < 0.12;
    if (isBackground) {
      score = 0;
      continue;
    }

    // Green = healthy (low score)
    if (h >= 60 && h <= 170 && s > 0.15) {
      score = 0.1;
    }
    // Brown/yellow (diseased indicator)
    else if (h >= 15 && h <= 50 && s > 0.12) {
      score = 0.6 + s * 0.4;
    }
    // Dark spots
    else if (v < 0.3 && s > 0.08) {
      score = 0.8;
    }
    // Red/purple spots
    else if ((h < 15 || h > 330) && s > 0.2) {
      score = 0.7;
    }
    // Other colors
    else {
      score = 0.3;
    }

    heatmap[i] = Math.min(1, Math.max(0, score));
  }

  // Apply Gaussian blur for smoother heatmap
  const blurred = gaussianBlur(heatmap, width, height, 5);

  // Normalize
  let maxVal = 0;
  for (let i = 0; i < blurred.length; i++) {
    if (blurred[i] > maxVal) maxVal = blurred[i];
  }

  // Create colored heatmap (JET colormap)
  const outputData = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const val = maxVal > 0 ? blurred[i] / maxVal : 0;
    const [cr, cg, cb] = jetColormap(val);

    outputData[i * 4] = cr;
    outputData[i * 4 + 1] = cg;
    outputData[i * 4 + 2] = cb;
    outputData[i * 4 + 3] = Math.round(val * 180); // Semi-transparent
  }

  return new ImageData(outputData, width, height);
}

/**
 * Render heatmap overlay on a canvas.
 */
export function renderHeatmapOverlay(
  canvas: HTMLCanvasElement,
  originalImage: HTMLImageElement | HTMLCanvasElement,
  opacity: number = 0.5
): void {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;

  // Draw original image
  ctx.drawImage(originalImage, 0, 0, width, height);

  // Generate and overlay heatmap
  const heatmapData = generateHeatmap(originalImage, width, height);

  // Create temporary canvas for heatmap
  const heatmapCanvas = document.createElement("canvas");
  heatmapCanvas.width = width;
  heatmapCanvas.height = height;
  const heatmapCtx = heatmapCanvas.getContext("2d")!;
  heatmapCtx.putImageData(heatmapData, 0, 0);

  // Overlay with opacity
  ctx.globalAlpha = opacity;
  ctx.drawImage(heatmapCanvas, 0, 0);
  ctx.globalAlpha = 1.0;
}

/**
 * JET colormap: maps [0, 1] to RGB color.
 */
function jetColormap(value: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, value));

  let r: number, g: number, b: number;

  if (v < 0.125) {
    r = 0;
    g = 0;
    b = 128 + v * 4 * 127;
  } else if (v < 0.375) {
    r = 0;
    g = (v - 0.125) * 4 * 255;
    b = 255;
  } else if (v < 0.625) {
    r = (v - 0.375) * 4 * 255;
    g = 255;
    b = 255 - (v - 0.375) * 4 * 255;
  } else if (v < 0.875) {
    r = 255;
    g = 255 - (v - 0.625) * 4 * 255;
    b = 0;
  } else {
    r = 255 - (v - 0.875) * 4 * 127;
    g = 0;
    b = 0;
  }

  return [Math.round(r), Math.round(g), Math.round(b)];
}

/**
 * Simple Gaussian blur for heatmap smoothing.
 */
function gaussianBlur(
  data: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const output = new Float32Array(data.length);
  const kernel = createGaussianKernel(radius);
  const kSize = radius * 2 + 1;

  // Horizontal pass
  const temp = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let wSum = 0;
      for (let k = -radius; k <= radius; k++) {
        const px = Math.min(width - 1, Math.max(0, x + k));
        const w = kernel[k + radius];
        sum += data[y * width + px] * w;
        wSum += w;
      }
      temp[y * width + x] = sum / wSum;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let wSum = 0;
      for (let k = -radius; k <= radius; k++) {
        const py = Math.min(height - 1, Math.max(0, y + k));
        const w = kernel[k + radius];
        sum += temp[py * width + x] * w;
        wSum += w;
      }
      output[y * width + x] = sum / wSum;
    }
  }

  return output;
}

function createGaussianKernel(radius: number): number[] {
  const sigma = radius / 2;
  const kernel: number[] = [];
  for (let i = -radius; i <= radius; i++) {
    kernel.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  }
  return kernel;
}
