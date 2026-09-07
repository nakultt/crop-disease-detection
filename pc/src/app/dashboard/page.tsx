"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import DiagnosisCard from "../components/DiagnosisCard";
import Dropzone from "../components/Dropzone";
import HeatmapViewer from "../components/HeatmapViewer";
import ModelStatus from "../components/ModelStatus";
import RecommendationPanel from "../components/RecommendationPanel";
import SeverityGauge from "../components/SeverityGauge";
import ThemeToggle from "../components/ThemeToggle";
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
    <>
      <a
        href="#main"
        className="btn btn-secondary"
        style={{
          position: "absolute",
          left: 12,
          top: -60,
          zIndex: 20,
          transition: "top var(--ease-out)",
        }}
        onFocus={(event) => {
          event.currentTarget.style.top = "12px";
        }}
        onBlur={(event) => {
          event.currentTarget.style.top = "-60px";
        }}
      >
        Skip to content
      </a>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          height: "var(--header-h)",
          display: "flex",
          alignItems: "center",
          background: "color-mix(in srgb, var(--bg) 85%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
        }}
      >
        <div
          className="shell"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            width: "100%",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 36,
              height: 36,
              borderRadius: "var(--radius-sm)",
              background: "var(--primary)",
              color: "var(--primary-on)",
              boxShadow: "var(--shadow-1)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 16c0-6 4-10 12-11 0 8-4 12-9 12a5 5 0 0 1-3-1Z" />
              <path d="M4 16c2-4 5-6.5 9-8" />
            </svg>
          </span>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 660,
                fontSize: 18,
                letterSpacing: "-0.015em",
                color: "var(--text)",
              }}
            >
              PlantGuard
            </div>
          </div>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {analyses.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Clear
              </button>
            )}
            <ThemeToggle />
            <Link href="/" className="btn btn-secondary" style={{ height: 36, padding: "0 16px", fontSize: 13, minHeight: 36 }}>
              Log Out
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="shell" style={{ paddingBlock: "48px 80px" }}>
        {analyses.length === 0 && (
          <section style={{ textAlign: "center", padding: "40px 0 64px" }}>
            <h1
              style={{
                fontSize: "clamp(36px, 6vw, 52px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                maxWidth: "20ch",
                marginInline: "auto",
                color: "var(--text)",
              }}
            >
              Detect plant diseases from a leaf photograph.
            </h1>
            <p
              className="muted"
              style={{
                fontSize: 18,
                marginTop: 24,
                maxWidth: "52ch",
                marginInline: "auto",
                lineHeight: 1.6,
              }}
            >
              PlantGuard is a smart plant disease detection tool powered by AI. Upload a leaf photograph to analyze its health.
            </p>
          </section>
        )}

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
              PlantGuard is analyzing your leaf...
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
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border)",
          paddingBlock: 32,
          marginTop: "auto",
        }}
      >
        <div
          className="shell dim"
          style={{
            fontSize: 13,
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <span>
            Runs entirely in your browser. Photographs never leave your device.
          </span>
          {manifest && (
            <span className="mono">
              {manifest.backbone.split(".")[0]} ·{" "}
              {manifest.classes.disease.length} classes
            </span>
          )}
        </div>
      </footer>
    </>
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
}: {
  analyses: Analysis[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-label="Previous analyses">
      <h2 className="label" style={{ marginBottom: 12 }}>
        This session
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
