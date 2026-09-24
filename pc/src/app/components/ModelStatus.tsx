"use client";

import { useLanguage } from "../lib/i18n/LanguageContext";
import type { TranslationKey } from "../lib/i18n/types";
import type { LoadProgress } from "../lib/inference";
import { formatBytes, type ModelManifest } from "../lib/manifest";
import { AlertCircleIcon, AlertIcon } from "./icons";

interface ModelStatusProps {
  manifest: ModelManifest | null;
  progress: LoadProgress | null;
  error: { message: string; hint?: string } | null;
  backend: string | null;
}

const PHASE_KEYS: Record<LoadProgress["phase"], TranslationKey> = {
  manifest: "model.phaseManifest",
  download: "model.phaseDownload",
  compile: "model.phaseCompile",
  ready: "model.phaseReady",
};

/**
 * The model's provenance in one line: someone acting on a diagnosis deserves
 * to know what produced it, whether it was actually trained, and how it
 * scored on held-out data.
 */
export default function ModelStatus({
  manifest,
  progress,
  error,
  backend,
}: ModelStatusProps) {
  const { t } = useLanguage();

  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        <AlertCircleIcon size={20} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650 }}>{t("model.unavailable")}</div>
          <p style={{ marginTop: 4, color: "var(--text-2)" }}>
            {error.message}
          </p>
          {error.hint && process.env.NODE_ENV !== "production" && (
            <p
              className="mono dim"
              style={{
                fontSize: 13,
                marginTop: 10,
                padding: "10px 14px",
                background: "var(--surface)",
                borderRadius: "var(--radius-sm)",
                overflowWrap: "anywhere",
              }}
            >
              {error.hint}
            </p>
          )}
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
          <span style={{ fontWeight: 600 }}>
            {t(PHASE_KEYS[progress.phase])}
          </span>
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
          aria-label={t("model.progressAria")}
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
        <div className="alert alert-warning" role="alert">
          <AlertIcon size={20} />
          <div>
            <div style={{ fontWeight: 650 }}>{t("model.demoTitle")}</div>
            <p style={{ marginTop: 4, color: "var(--text-2)" }}>
              {t("model.demoDesc")}
            </p>
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
        <Fact
          label={t("model.backbone")}
          value={manifest.backbone.split(".")[0]}
          mono
        />
        <Fact label={t("model.size")} value={formatBytes(manifest.sizeBytes)} />
        <Fact label={t("model.precision")} value={manifest.precision} />
        <Fact
          label={t("model.explanation")}
          value={
            manifest.cam.exact ? t("model.exactCam") : t("model.approxCam")
          }
          title={
            manifest.cam.exact ? t("model.exactHint") : t("model.approxHint")
          }
        />
        {backend && <Fact label={t("model.runtime")} value={backend} />}
        {manifest.metrics && (
          <Fact
            label={t("model.accuracy")}
            value={`${(manifest.metrics.diseaseAccuracy * 100).toFixed(1)}%`}
            title={`Macro-F1 ${manifest.metrics.diseaseMacroF1.toFixed(3)} · ${manifest.metrics.numSamples.toLocaleString()}`}
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
      <span
        className="dim"
        style={{
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          fontSize: 11,
        }}
      >
        {label}
      </span>
      <span
        className={mono ? "mono" : undefined}
        style={{
          fontWeight: 650,
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
