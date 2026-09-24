"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import DiagnosisCard from "../components/DiagnosisCard";
import Dropzone from "../components/Dropzone";
import HeatmapViewer from "../components/HeatmapViewer";
import { CheckCircleIcon } from "../components/icons";
import ModelStatus from "../components/ModelStatus";
import RecommendationPanel from "../components/RecommendationPanel";
import SeverityGauge from "../components/SeverityGauge";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { Translate, TranslationKey } from "../lib/i18n/types";
import {
  backendLabel,
  camForClass,
  getManifest,
  type LoadProgress,
  loadModel,
  type PredictionResult,
  predict,
} from "../lib/inference";
import { classLabel } from "../lib/labels";
import { ManifestError, type ModelManifest } from "../lib/manifest";
import { SaveScanError, saveScan } from "../lib/save-scan";

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; id: string }
  | { status: "error"; message: string };

interface Analysis {
  id: string;
  fileName: string;
  previewUrl: string;
  image: HTMLImageElement;
  input: HTMLCanvasElement;
  result: PredictionResult;
  save: SaveState;
}

interface LoadError {
  message: string;
  hint?: string;
}

const SAVE_ERROR_KEYS: Record<string, TranslationKey> = {
  rate_limited: "scan.errRateLimited",
  quota_exceeded: "scan.errQuota",
  model_mismatch: "scan.errModel",
  too_large: "scan.errTooLarge",
  unauthenticated: "scan.errSignedOut",
};

export interface ScanPreferences {
  autoSave: boolean;
  savePhotos: boolean;
}

export default function ScanClient({
  preferences,
}: {
  preferences: ScanPreferences;
}) {
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

  const setSaveState = useCallback((id: string, save: SaveState) => {
    setAnalyses((prev) => prev.map((a) => (a.id === id ? { ...a, save } : a)));
  }, []);

  const persist = useCallback(
    async (analysis: Analysis, currentManifest: ModelManifest) => {
      setSaveState(analysis.id, { status: "saving" });
      try {
        const scanId = await saveScan({
          result: analysis.result,
          manifest: currentManifest,
          fileName: analysis.fileName,
          image: analysis.image,
          includePhoto: preferences.savePhotos,
        });
        setSaveState(analysis.id, { status: "saved", id: scanId });
      } catch (error) {
        const known =
          error instanceof SaveScanError
            ? SAVE_ERROR_KEYS[error.code]
            : undefined;
        setSaveState(analysis.id, {
          status: "error",
          message: known
            ? t(known)
            : error instanceof TypeError
              ? t("scan.errOffline")
              : error instanceof Error
                ? error.message
                : "",
        });
      }
    },
    [preferences.savePhotos, setSaveState, t],
  );

  const active = analyses.find((a) => a.id === activeId) ?? null;

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!manifest) return;
      setRunError(null);
      setBusy(true);

      try {
        for (const file of files) {
          const url = URL.createObjectURL(file);
          objectUrls.current.push(url);

          const image = await loadImage(url, t);
          const { result, input } = await predict(
            image,
            image.naturalWidth,
            image.naturalHeight,
          );

          const analysis: Analysis = {
            id: `${file.name}-${file.size}-${result.inferenceMs.toFixed(3)}-${Date.now()}`,
            fileName: file.name,
            previewUrl: url,
            image,
            input,
            result,
            save: { status: "idle" },
          };

          setAnalyses((prev) => [analysis, ...prev].slice(0, 12));
          setActiveId(analysis.id);
          setSelectedClass(result.disease.index);

          if (preferences.autoSave) void persist(analysis, manifest);
        }
      } catch (error) {
        setRunError(error instanceof Error ? error.message : t("scan.failed"));
      } finally {
        setBusy(false);
      }
    },
    [manifest, persist, preferences.autoSave, t],
  );

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

  const privacyNote: TranslationKey = !preferences.autoSave
    ? "dropzone.privacyLocal"
    : preferences.savePhotos
      ? "dropzone.privacySaved"
      : "dropzone.privacyResultsOnly";

  return (
    <main id="main" className="shell page" style={{ maxWidth: 1100 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{t("scan.title")}</h1>
          <p className="page-desc">{t("scan.tips")}</p>
        </div>
        {analyses.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={reset}
          >
            {t("scan.clear")}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: 24 }}>
        <ModelStatus
          manifest={manifest}
          progress={progress}
          error={loadError}
          backend={backend}
        />

        <Dropzone
          onFiles={handleFiles}
          disabled={!modelUsable || busy}
          compact={analyses.length > 0}
          privacyNote={privacyNote}
        />

        <p
          className="dim"
          style={{ fontSize: 13, textAlign: "center", marginTop: -8 }}
        >
          {preferences.autoSave ? t("scan.autosaveOn") : t("scan.autosaveOff")}{" "}
          <Link href="/settings#preferences">{t("scan.changeInSettings")}</Link>
        </p>

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
            {t("scan.analyzing")}
          </div>
        )}

        {runError && (
          <div role="alert" className="alert alert-error">
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

        {active && camGrid && manifest && (
          <>
            <SaveBar
              state={active.save}
              onSave={() => void persist(active, manifest)}
              t={t}
            />

            <div
              className="rise"
              style={{
                display: "grid",
                gap: 24,
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
                alignItems: "start",
              }}
            >
              <div className="sticky-col">
                <HeatmapViewer
                  source={active.input}
                  cam={camGrid}
                  gridH={active.result.gridH}
                  gridW={active.result.gridW}
                  explaining={classLabel(
                    manifest.classes.disease[camIndex] ??
                      active.result.disease.className,
                    t,
                  )}
                  exact={manifest.cam.exact}
                />
              </div>

              <div style={{ display: "grid", gap: 24 }}>
                <DiagnosisCard
                  disease={active.result.disease}
                  selectedIndex={camIndex}
                  onSelect={setSelectedClass}
                  inferenceMs={active.result.inferenceMs}
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
                  trustworthy={manifest.trained}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SaveBar({
  state,
  onSave,
  t,
}: {
  state: SaveState;
  onSave: () => void;
  t: Translate;
}) {
  if (state.status === "saving") {
    return (
      <div className="alert alert-info" aria-live="polite">
        <span
          className="spinner"
          style={{ width: 18, height: 18, color: "var(--primary)" }}
        />
        <span>{t("scan.saving")}</span>
      </div>
    );
  }

  if (state.status === "saved") {
    return (
      <div
        className="alert alert-success"
        aria-live="polite"
        style={{ alignItems: "center" }}
      >
        <CheckCircleIcon size={18} />
        <span style={{ flex: 1 }}>{t("scan.saved")}</span>
        <Link
          href={`/history/${state.id}`}
          className="btn btn-secondary btn-sm"
        >
          {t("scan.view")}
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="alert alert-error"
        role="alert"
        style={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <span style={{ flex: 1, minWidth: 200 }}>
          <strong>{t("scan.saveFailed")}</strong> {state.message}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onSave}
        >
          {t("scan.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="alert" style={{ alignItems: "center" }}>
      <span style={{ flex: 1 }}>{t("scan.autosaveOff")}</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={onSave}>
        {t("scan.save")}
      </button>
    </div>
  );
}

function loadImage(url: string, t: Translate): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(t("scan.decodeError")));
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
  t: Translate;
}) {
  return (
    <section aria-label={t("scan.thisSession")}>
      <h2 className="label" style={{ marginBottom: 12 }}>
        {t("scan.thisSession")}
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
              title={`${analysis.fileName} — ${classLabel(analysis.result.disease.className, t)}`}
              className="session-thumb"
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
                {analysis.save.status === "saved" && " ✓"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
