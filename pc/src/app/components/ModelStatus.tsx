"use client";

import type { LoadProgress } from "../lib/inference";
import { formatBytes, type ModelManifest } from "../lib/manifest";

interface ModelStatusProps {
  manifest: ModelManifest | null;
  progress: LoadProgress | null;
  error: { message: string; hint?: string } | null;
  backend: string | null;
}

const PHASE_COPY: Record<LoadProgress["phase"], string> = {
  manifest: "Reading model manifest",
  download: "Downloading model",
  compile: "Preparing model",
  ready: "Model ready",
};

export default function ModelStatus({
  manifest,
  progress,
  error,
  backend,
}: ModelStatusProps) {
  if (error) {
    return (
      <div
        className="card card-pad"
        role="alert"
        style={{
          borderColor: "color-mix(in srgb, var(--critical) 40%, var(--border))",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span
            style={{ color: "var(--critical)", flex: "none", marginTop: 2 }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="7" />
              <path d="M9 5.5v4M9 12.3v.2" />
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 660, fontSize: 15 }}>
              No model available
            </div>
            <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              {error.message}
            </p>
            {error.hint && (
              <p
                className="mono dim"
                style={{
                  fontSize: 13,
                  marginTop: 10,
                  padding: "10px 14px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-sm)",
                  overflowWrap: "anywhere",
                }}
              >
                {error.hint}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const loading = progress !== null && progress.phase !== "ready";
  if (loading) {
    const pct =
      progress.totalBytes > 0
        ? Math.min(100, (progress.loadedBytes / progress.totalBytes) * 100)
        : 0;

    return (
      <div className="card card-pad" aria-live="polite">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 14,
            marginBottom: 12,
          }}
        >
          <span className="spinner" style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600 }}>{PHASE_COPY[progress.phase]}</span>
          {progress.phase === "download" && progress.totalBytes > 0 && (
            <span
              className="dim tnum"
              style={{ marginLeft: "auto", fontSize: 13, fontWeight: 500 }}
            >
              {formatBytes(progress.loadedBytes)} /{" "}
              {formatBytes(progress.totalBytes)}
            </span>
          )}
        </div>
        <div
          className="meter"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Model download progress"
        >
          <i
            style={{
              width: `${pct}%`,
              opacity: progress.phase === "compile" ? 0.6 : 1,
            }}
          />
        </div>
      </div>
    );
  }

  if (!manifest) return null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {!manifest.trained && (
        <div
          role="alert"
          className="card card-pad"
          style={{
            borderColor:
              "color-mix(in srgb, var(--moderate) 45%, var(--border))",
            background: "var(--moderate-soft)",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span
              style={{ color: "var(--moderate)", flex: "none", marginTop: 2 }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M9 2.5 16.5 15h-15L9 2.5Z" />
                <path d="M9 7v3.4M9 12.8v.2" />
              </svg>
            </span>
            <div>
              <div style={{ fontWeight: 660, fontSize: 15 }}>
                Demo model — predictions are not meaningful
              </div>
              <p style={{ fontSize: 14, marginTop: 4, color: "var(--text-2)", lineHeight: 1.5 }}>
                This model was exported with{" "}
                <code className="mono">--demo</code>, so its classification
                heads are untrained and every result is effectively random.
                Train a model and re-export before reading anything into a
                diagnosis.
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          padding: "12px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px 20px",
          fontSize: 13,
        }}
      >
        <Fact label="Backbone" value={manifest.backbone.split(".")[0]} mono />
        <Fact label="Size" value={formatBytes(manifest.sizeBytes)} />
        <Fact label="Precision" value={manifest.precision} />
        <Fact
          label="Explanation"
          value={manifest.cam.exact ? "Exact CAM" : "Approximate CAM"}
          title={
            manifest.cam.exact
              ? "The heatmap is an algebraic identity on the model's own logits, not an estimate."
              : "This backbone does not expose an unpooled feature grid, so the heatmap approximates the model's attention."
          }
        />
        {backend && <Fact label="Runtime" value={backend} />}
        {manifest.metrics && (
          <Fact
            label="Test accuracy"
            value={`${(manifest.metrics.diseaseAccuracy * 100).toFixed(1)}%`}
            title={`Macro-F1 ${manifest.metrics.diseaseMacroF1.toFixed(3)} over ${manifest.metrics.numSamples.toLocaleString()} held-out images`}
          />
        )}
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  mono,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "baseline",
        minWidth: 0,
      }}
    >
      <span className="dim" style={{ fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", fontSize: 11 }}>{label}</span>
      <span
        className={mono ? "mono" : undefined}
        style={{
          fontWeight: 660,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: "var(--text)",
        }}
      >
        {value}
      </span>
    </span>
  );
}
