"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLORMAP_NAMES,
  type ColormapName,
  colormapLut,
  describeHotspot,
  normalizeCam,
  renderOverlay,
} from "../lib/cam";

type ViewMode = "overlay" | "split";

interface HeatmapViewerProps {
  source: HTMLCanvasElement;
  cam: Float32Array;
  gridH: number;
  gridW: number;
  explaining: string;
  exact: boolean;
}

const CANVAS_SIZE = 512;

export default function HeatmapViewer({
  source,
  cam,
  gridH,
  gridW,
  explaining,
  exact,
}: HeatmapViewerProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const plainRef = useRef<HTMLCanvasElement>(null);

  const [opacity, setOpacity] = useState(0.65);
  const [colormap, setColormap] = useState<ColormapName>("inferno");
  const [mode, setMode] = useState<ViewMode>("overlay");

  const normalized = useMemo(() => normalizeCam(cam), [cam]);
  const description = useMemo(
    () => describeHotspot(normalized, gridH, gridW),
    [normalized, gridH, gridW],
  );

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    renderOverlay(canvas, source, normalized, gridH, gridW, colormap, opacity);
  }, [source, normalized, gridH, gridW, colormap, opacity]);

  useEffect(() => {
    const canvas = plainRef.current;
    if (!canvas || mode !== "split") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }, [source, mode]);

  return (
    <section className="card card-pad" aria-labelledby="heatmap-heading">
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2
            id="heatmap-heading"
            className="label"
            style={{ marginBottom: 6 }}
          >
            Why did PlantGuard make this prediction?
          </h2>
          <p className="dim" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {exact
              ? "The highlighted regions show the areas that contributed to the prediction"
              : "Approximate activation map for this prediction"} for{" "}
            <strong style={{ color: "var(--text)", fontWeight: 660 }}>
              {explaining}
            </strong>
          </p>
        </div>

        <fieldset
          className="segmented"
          style={{ border: 0, padding: 4, margin: 0 }}
        >
          <legend className="sr-only">View mode</legend>
          {(["overlay", "split"] as ViewMode[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {value === "overlay" ? "Overlay" : "Side by side"}
            </button>
          ))}
        </fieldset>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: mode === "split" ? "1fr 1fr" : "1fr",
          gap: 16,
        }}
      >
        {mode === "split" && (
          <figure style={{ margin: 0 }}>
            <canvas
              ref={plainRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              aria-label="The leaf photograph as the model received it, without a heatmap."
              style={canvasStyle}
            />
            <figcaption className="dim" style={captionStyle}>
              Original Image
            </figcaption>
          </figure>
        )}

        <figure style={{ margin: 0 }}>
          <canvas
            ref={overlayRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            role="img"
            aria-label={`Heatmap over the leaf photograph. ${description}`}
            style={canvasStyle}
          />
          <figcaption className="dim" style={captionStyle}>
            {mode === "split" ? "AI Evidence" : description}
          </figcaption>
        </figure>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
          marginTop: 24,
          padding: "16px",
          background: "var(--surface-2)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 160 }}>
          <label
            htmlFor="heatmap-opacity"
            className="label"
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span>Overlay Intensity</span>
            <output className="tnum" htmlFor="heatmap-opacity" style={{ color: "var(--primary)" }}>
              {Math.round(opacity * 100)}%
            </output>
          </label>
          <input
            id="heatmap-opacity"
            className="range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
          />
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 10 }}>
            Colour scale
          </legend>
          <div className="segmented">
            {COLORMAP_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={colormap === name}
                onClick={() => setColormap(name)}
                style={{ textTransform: "capitalize" }}
              >
                {name}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <ScaleLegend colormap={colormap} />
    </section>
  );
}

const canvasStyle: React.CSSProperties = {
  width: "100%",
  height: "auto",
  aspectRatio: "1 / 1",
  display: "block",
  borderRadius: "var(--radius-lg)",
  background: "var(--surface-2)",
  boxShadow: "var(--shadow-1)",
};

const captionStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  marginTop: 10,
  textAlign: "center",
};

function ScaleLegend({ colormap }: { colormap: ColormapName }) {
  const gradient = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      stops.push(`${sampleCss(colormap, t)} ${t * 100}%`);
    }
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  }, [colormap]);

  return (
    <div style={{ marginTop: 24, padding: "0 8px" }}>
      <div
        aria-hidden="true"
        style={{
          height: 10,
          borderRadius: "var(--radius-full)",
          background: gradient,
          border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
        }}
      />
      <div
        className="dim"
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          fontWeight: 600,
          marginTop: 8,
        }}
      >
        <span>Little influence</span>
        <span>Strong influence on prediction</span>
      </div>
    </div>
  );
}

function sampleCss(colormap: ColormapName, t: number): string {
  const lut = colormapLut(colormap);
  const i = Math.round(t * 255) * 3;
  return `rgb(${lut[i]} ${lut[i + 1]} ${lut[i + 2]})`;
}
