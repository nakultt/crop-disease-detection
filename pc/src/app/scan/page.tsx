"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import DiagnosisCard from "../components/DiagnosisCard";
import Dropzone from "../components/Dropzone";
import HeatmapViewer from "../components/HeatmapViewer";
import ModelStatus from "../components/ModelStatus";
import RecommendationPanel from "../components/RecommendationPanel";
import SeverityGauge from "../components/SeverityGauge";
import {
  backendLabel,
  camForClass,
  getManifest,
  type LoadProgress,
  loadModel,
  type PredictionResult,
  predict,
} from "../lib/inference";
import { displayName, ManifestError, type ModelManifest } from "../lib/manifest";
import { useLanguage } from "../lib/i18n/LanguageContext";

interface Analysis {
  id: string;
  fileName: string;
  previewUrl: string;
  input: HTMLCanvasElement;
  result: PredictionResult;
}

interface LoadError {
  message: string;
  hint?: string;
}

export default function Home() {
  const { t } = useLanguage();
  const [manifest, setManifest] = useState<ModelManifest | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [backend, setBackend] = useState<string | null>(null);

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Object URLs outlive React state, so track them for explicit revocation.
  const objectUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  // Warm the model up front: the download dominates time-to-first-result, and
  // starting it on page load means it is usually finished before an image is.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loaded = await getManifest();
        if (cancelled) return;
        setManifest(loaded);

        await loadModel((p) => {
          if (!cancelled) setProgress(p);
        });
        if (cancelled) return;
        setBackend(backendLabel());
      } catch (error) {
        if (cancelled) return;
        setProgress(null);
        setLoadError(
          error instanceof ManifestError
            ? { message: error.message, hint: error.hint }
            : {
                message:
                  error instanceof Error
                    ? error.message
                    : "Unknown error loading the model.",
                hint: "Export a model from training/: `uv run python main.py export --demo`",
              },
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const active = analyses.find((a) => a.id === activeId) ?? null;

  const handleFiles = useCallback(async (files: File[]) => {
    setRunError(null);
    setBusy(true);

    try {
      for (const file of files) {
        const url = URL.createObjectURL(file);
        objectUrls.current.push(url);

        const image = await loadImage(url);
        const { result, input } = await predict(
          image,
          image.naturalWidth,
          image.naturalHeight,
        );

        const analysis: Analysis = {
          id: `${file.name}-${file.size}-${result.inferenceMs.toFixed(3)}`,
          fileName: file.name,
          previewUrl: url,
          input,
          result,
        };

        setAnalyses((prev) => [analysis, ...prev].slice(0, 12));
        setActiveId(analysis.id);
        setSelectedClass(result.disease.index);
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  function reset() {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current = [];
    setAnalyses([]);
    setActiveId(null);
    setSelectedClass(null);
    setRunError(null);
  }

  const modelUsable = manifest !== null && loadError === null;
  const camIndex = selectedClass ?? active?.result.disease.index ?? 0;
  const camGrid = active ? camForClass(active.result, camIndex) : null;

  return (
    <main id="main" className="shell" style={{ paddingBlock: "32px 80px", maxWidth: "800px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{t("scan.title")}</h1>
        {analyses.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 14 }}>
            {t("scan.clear")}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: 24, margin: "0 auto" }}>

        <div style={{ display: "grid", gap: 24, maxWidth: analyses.length === 0 ? "800px" : "none", margin: "0 auto" }}>
          <ModelStatus
            manifest={manifest}
            progress={progress}
            error={loadError}
            backend={backend}
          />

          {analyses.length === 0 ? (
            <Dropzone onFiles={handleFiles} disabled={!modelUsable || busy} />
          ) : (
            <Dropzone
              onFiles={handleFiles}
              disabled={!modelUsable || busy}
              compact
            />
          )}

          {busy && (
            <div
              className="card card-pad"
              aria-live="polite"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              <span className="spinner" style={{ color: "var(--primary)" }} />
              {t("scan.analyzing") || "PlantGuard is analyzing your leaf..."}
            </div>
          )}

          {runError && (
            <div
              role="alert"
              className="card card-pad"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--critical) 40%, var(--border))",
                color: "var(--critical)",
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              {runError}
            </div>
          )}

          {analyses.length > 1 && (
            <HistoryStrip
              analyses={analyses}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                const chosen = analyses.find((a) => a.id === id);
                setSelectedClass(chosen?.result.disease.index ?? null);
              }}
              t={t}
            />
          )}

          {active && camGrid && (
            <div
              className="rise"
              style={{
                display: "grid",
                gap: 24,
                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                alignItems: "start",
                marginTop: 16,
              }}
            >
              <div style={{ display: "grid", gap: 24 }}>
                <HeatmapViewer
                  source={active.input}
                  cam={camGrid}
                  gridH={active.result.gridH}
                  gridW={active.result.gridW}
                  explaining={displayName(
                    manifest?.classes.disease[camIndex] ??
                      active.result.disease.className,
                  )}
                  exact={manifest?.cam.exact ?? false}
                />
              </div>

              <div style={{ display: "grid", gap: 24 }}>
                <DiagnosisCard
                  result={active.result}
                  selectedIndex={camIndex}
                  onSelect={setSelectedClass}
                />
                <SeverityGauge
                  level={active.result.severity.className}
                  range={active.result.severity.range}
                  probability={active.result.severity.probability}
                  distribution={active.result.severity.distribution}
                  healthy={active.result.disease.healthy}
                />
                <RecommendationPanel
                  diseaseClass={active.result.disease.className}
                  severity={active.result.severity.className}
                  healthy={active.result.disease.healthy}
                  trustworthy={manifest?.trained ?? false}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("That file could not be decoded as an image."));
    image.src = url;
  });
}

function HistoryStrip({
  analyses,
  activeId,
  onSelect,
  t,
}: {
  analyses: Analysis[];
  activeId: string | null;
  onSelect: (id: string) => void;
  t: (k: string) => string;
}) {
  return (
    <section aria-label="Previous analyses">
      <h2 className="label" style={{ marginBottom: 12 }}>
        {t("scan.thisSession") || "This session"}
      </h2>
      <div
        className="scroll-x"
        style={{ display: "flex", gap: 12, paddingBottom: 8 }}
      >
        {analyses.map((analysis) => {
          const active = analysis.id === activeId;
          return (
            <button
              key={analysis.id}
              type="button"
              onClick={() => onSelect(analysis.id)}
              aria-pressed={active}
              title={`${analysis.fileName} — ${displayName(analysis.result.disease.className)}`}
              style={{
                flex: "none",
                width: 110,
                padding: 6,
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${active ? "var(--primary)" : "transparent"}`,
                background: active ? "var(--primary-soft)" : "var(--surface)",
                boxShadow: "var(--shadow-1)",
                transition:
                  "border-color var(--ease-out), background var(--ease-out), transform var(--ease-out)",
                transform: active ? "scale(1.02)" : "scale(1)",
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: the source is a blob: object URL for a file the user just picked, which next/image cannot optimise. */}
              <img
                src={analysis.previewUrl}
                alt=""
                width={94}
                height={70}
                style={{
                  width: "100%",
                  height: 70,
                  objectFit: "cover",
                  borderRadius: "var(--radius-md)",
                  display: "block",
                }}
              />
              <span
                className="tnum"
                style={{
                  display: "block",
                  fontSize: 12,
                  marginTop: 6,
                  color: active ? "var(--primary)" : "var(--text-3)",
                  fontWeight: 600,
                }}
              >
                {(analysis.result.disease.probability * 100).toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
