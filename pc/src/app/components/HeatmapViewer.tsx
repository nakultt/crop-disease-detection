"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLORMAP_NAMES,
  type ColormapName,
  colormapLut,
  type HotspotSummary,
  normalizeCam,
  renderOverlay,
  summarizeHotspot,
} from "../lib/cam";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { Translate, TranslationKey } from "../lib/i18n/types";

type ViewMode = "overlay" | "split";

interface HeatmapViewerProps {
  /** The square image the model saw; `null` when no photo was kept. */
  source: HTMLCanvasElement | null;
  cam: Float32Array;
  gridH: number;
  gridW: number;
  /** Name of the class this heatmap explains, for the caption. */
  explaining: string;
  exact: boolean;
}

const CANVAS_SIZE = 512;

function describe(summary: HotspotSummary, t: Translate): string {
  if (summary.spread === "none") return t("cam.noFocus");
  const region = t(`cam.region.${summary.region}` as TranslationKey);
  const template: TranslationKey =
    summary.spread === "tight"
      ? "cam.focusTight"
      : summary.spread === "focused"
        ? "cam.focus"
        : "cam.focusBroad";
  return t(template, region);
}

/** A blank square to draw the heatmap on when there is no photo. */
function placeholderCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1e2922";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
  return canvas;
}

/**
 * Shows where the model looked. The heatmap is read straight out of the ONNX
 * graph, so it reflects the actual evidence behind the prediction rather than
 * a colour heuristic applied to the photograph.
 */
export default function HeatmapViewer({
  source,
  cam,
  gridH,
  gridW,
  explaining,
  exact,
}: HeatmapViewerProps) {
  const { t } = useLanguage();
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const plainRef = useRef<HTMLCanvasElement>(null);

  const [opacity, setOpacity] = useState(0.65);
  const [colormap, setColormap] = useState<ColormapName>("inferno");
  const [mode, setMode] = useState<ViewMode>("overlay");

  const normalized = useMemo(() => normalizeCam(cam), [cam]);
  const description = useMemo(
    () => describe(summarizeHotspot(normalized, gridH, gridW), t),
    [normalized, gridH, gridW, t],
  );

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    renderOverlay(
      canvas,
      source ?? placeholderCanvas(),
      normalized,
      gridH,
      gridW,
      colormap,
      source ? opacity : Math.max(opacity, 0.9),
    );
  }, [source, normalized, gridH, gridW, colormap, opacity]);

  useEffect(() => {
    const canvas = plainRef.current;
    if (!canvas || mode !== "split" || !source) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }, [source, mode]);

  const splitAvailable = source !== null;
  const effectiveMode = splitAvailable ? mode : "overlay";

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
        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
          <h2
            id="heatmap-heading"
            className="label"
            style={{ marginBottom: 6 }}
          >
            {t("cam.title")}
          </h2>
          <p className="dim" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {exact ? t("cam.exactDesc") : t("cam.approxDesc")} {t("cam.for")}{" "}
            <strong style={{ color: "var(--text)", fontWeight: 650 }}>
              {explaining}
            </strong>
          </p>
        </div>

        {splitAvailable && (
          <fieldset className="segmented" style={{ border: 0, margin: 0 }}>
            <legend className="sr-only">{t("cam.viewMode")}</legend>
            {(["overlay", "split"] as ViewMode[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {value === "overlay" ? t("cam.overlay") : t("cam.split")}
              </button>
            ))}
          </fieldset>
        )}
      </header>

      {!source && (
        <p className="alert alert-info" style={{ marginBottom: 16 }}>
          {t("cam.noPhoto")}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: effectiveMode === "split" ? "1fr 1fr" : "1fr",
          gap: 16,
        }}
      >
        {effectiveMode === "split" && (
          <figure style={{ margin: 0 }}>
            <canvas
              ref={plainRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              role="img"
              aria-label={t("cam.inputAria")}
              style={canvasStyle}
            />
            <figcaption className="dim" style={captionStyle}>
              {t("cam.original")}
            </figcaption>
          </figure>
        )}

        <figure style={{ margin: 0 }}>
          <canvas
            ref={overlayRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            role="img"
            aria-label={t("cam.aria", description)}
            style={canvasStyle}
          />
          <figcaption className="dim" style={captionStyle}>
            {effectiveMode === "split" ? t("cam.evidence") : description}
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
          padding: 16,
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
            <span>{t("cam.intensity")}</span>
            <output
              className="tnum"
              htmlFor="heatmap-opacity"
              style={{ color: "var(--primary)" }}
            >
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
            {t("cam.scale")}
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

      <ScaleLegend
        colormap={colormap}
        little={t("cam.little")}
        strong={t("cam.strong")}
      />
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

/** A gradient bar so the colours read as values, not decoration. */
function ScaleLegend({
  colormap,
  little,
  strong,
}: {
  colormap: ColormapName;
  little: string;
  strong: string;
}) {
  const gradient = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const at = i / 10;
      stops.push(`${sampleCss(colormap, at)} ${at * 100}%`);
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
          border:
            "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
        }}
      />
      <div
        className="dim"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
          fontWeight: 600,
          marginTop: 8,
        }}
      >
        <span>{little}</span>
        <span style={{ textAlign: "right" }}>{strong}</span>
      </div>
    </div>
  );
}

function sampleCss(colormap: ColormapName, at: number): string {
  const lut = colormapLut(colormap);
  const i = Math.round(at * 255) * 3;
  return `rgb(${lut[i]} ${lut[i + 1]} ${lut[i + 2]})`;
}
