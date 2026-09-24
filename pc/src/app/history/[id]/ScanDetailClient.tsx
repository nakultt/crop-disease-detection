"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "../../components/Alert";
import DiagnosisCard from "../../components/DiagnosisCard";
import HeatmapViewer from "../../components/HeatmapViewer";
import {
  AlertIcon,
  ChevronLeftIcon,
  DownloadIcon,
  TrashIcon,
} from "../../components/icons";
import LocalTime from "../../components/LocalTime";
import RecommendationPanel from "../../components/RecommendationPanel";
import SeverityGauge from "../../components/SeverityGauge";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import { classLabel, conditionLabel, cropLabel } from "../../lib/labels";
import {
  base64ToFloats,
  SCAN_LIMITS,
  type ScanDetail,
} from "../../lib/scan-contract";

const CANVAS_SIZE = 512;

/** The centre square of the photo — the same crop the model analysed. */
function centreSquare(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      CANVAS_SIZE,
      CANVAS_SIZE,
    );
  }
  return canvas;
}

export default function ScanDetailClient({
  scan,
  exact,
}: {
  scan: ScanDetail;
  exact: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();

  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [photoState, setPhotoState] = useState<
    "loading" | "ready" | "none" | "error"
  >(scan.hasImage ? "loading" : "none");
  const [selected, setSelected] = useState(scan.diseaseIndex);

  const cube = useMemo(
    () => base64ToFloats(scan.cam.disease),
    [scan.cam.disease],
  );
  const plane = scan.cam.gridH * scan.cam.gridW;
  const camGrid = useMemo(() => {
    const start = selected * plane;
    return start + plane <= cube.length
      ? cube.slice(start, start + plane)
      : cube.slice(scan.diseaseIndex * plane, (scan.diseaseIndex + 1) * plane);
  }, [cube, plane, selected, scan.diseaseIndex]);

  useEffect(() => {
    if (!scan.hasImage) return;
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      setSource(centreSquare(image));
      setPhotoState("ready");
    };
    image.onerror = () => !cancelled && setPhotoState("error");
    image.src = `/api/scans/${scan.id}/image`;
    return () => {
      cancelled = true;
    };
  }, [scan.id, scan.hasImage]);

  const selectedName =
    scan.topK.find((c) => c.index === selected)?.className ?? scan.className;

  return (
    <main id="main" className="shell page">
      <Link href="/history" className="link-arrow" style={{ marginBottom: 16 }}>
        <ChevronLeftIcon size={16} />
        {t("detail.back")}
      </Link>

      <header className="page-header" style={{ marginTop: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div
            className="dim"
            style={{
              fontSize: 13,
              fontWeight: 650,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {cropLabel(scan.className, t)}
          </div>
          <h1 className="page-title">{conditionLabel(scan.className, t)}</h1>
          <p
            className="page-desc"
            style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}
          >
            <span>
              {t("detail.scanned")}{" "}
              <LocalTime iso={scan.createdAt} kind="datetime" />
            </span>
            {scan.label && (
              <span className="badge badge-primary">{scan.label}</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {scan.hasImage && (
            <a
              href={`/api/scans/${scan.id}/image?download=1`}
              className="btn btn-secondary btn-sm"
              download
            >
              <DownloadIcon size={16} />
              {t("detail.download")}
            </a>
          )}
          <DeleteButton
            scanId={scan.id}
            onDeleted={() => {
              router.push("/history");
              router.refresh();
            }}
          />
        </div>
      </header>

      {!scan.model.trained && (
        <div style={{ marginBottom: 20 }}>
          <Alert tone="warning">{t("detail.untrained")}</Alert>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 24,
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 24 }}>
          {photoState === "loading" ? (
            <div className="card card-pad" aria-busy="true">
              <div
                className="skeleton"
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: "var(--radius-lg)",
                }}
              />
              <p className="dim" style={{ marginTop: 12, fontSize: 13 }}>
                {t("detail.loadingPhoto")}
              </p>
            </div>
          ) : (
            <HeatmapViewer
              source={source}
              cam={camGrid}
              gridH={scan.cam.gridH}
              gridW={scan.cam.gridW}
              explaining={classLabel(selectedName, t)}
              exact={exact}
            />
          )}
          <NotesEditor scan={scan} />
        </div>

        <div style={{ display: "grid", gap: 24 }}>
          <DiagnosisCard
            disease={{
              className: scan.className,
              index: scan.diseaseIndex,
              probability: scan.confidence,
              healthy: scan.healthy,
              topK: scan.topK,
            }}
            selectedIndex={selected}
            onSelect={setSelected}
          />
          <SeverityGauge
            level={scan.severityDetail.className}
            range={scan.severityDetail.range}
            probability={scan.severityDetail.probability}
            distribution={scan.severityDetail.distribution}
            healthy={scan.healthy}
          />
          <RecommendationPanel
            diseaseClass={scan.className}
            severity={scan.severityDetail.className}
            healthy={scan.healthy}
            trustworthy={scan.model.trained}
          />
          <section className="card card-pad" aria-labelledby="details-heading">
            <h2
              id="details-heading"
              className="label"
              style={{ marginBottom: 14 }}
            >
              {t("detail.infoTitle")}
            </h2>
            <dl className="details-list">
              <dt>{t("detail.date")}</dt>
              <dd>
                <LocalTime iso={scan.createdAt} kind="datetime" />
              </dd>
              {scan.fileName && (
                <>
                  <dt>{t("detail.fileName")}</dt>
                  <dd className="break-all">{scan.fileName}</dd>
                </>
              )}
              <dt>{t("detail.model")}</dt>
              <dd className="mono break-all">
                {scan.model.backbone.split(".")[0]}
              </dd>
              <dt>{t("detail.modelVersion")}</dt>
              <dd className="mono break-all">{scan.model.version}</dd>
              <dt>{t("detail.analysisTime")}</dt>
              <dd className="tnum">{Math.round(scan.inferenceMs)} ms</dd>
              <dt>{t("detail.scanId")}</dt>
              <dd className="mono break-all">{scan.id}</dd>
            </dl>
          </section>
        </div>
      </div>

      {photoState === "error" && (
        <p className="field-error" style={{ marginTop: 16 }}>
          {t("detail.photoError")}
        </p>
      )}
    </main>
  );
}

function NotesEditor({ scan }: { scan: ScanDetail }) {
  const { t } = useLanguage();
  const [label, setLabel] = useState(scan.label);
  const [notes, setNotes] = useState(scan.notes);
  const [saved, setSaved] = useState({ label: scan.label, notes: scan.notes });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const dirty = label !== saved.label || notes !== saved.notes;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      const response = await fetch(`/api/scans/${scan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), notes: notes.trim() }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setSaved({ label: label.trim(), notes: notes.trim() });
      setLabel(label.trim());
      setNotes(notes.trim());
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="card card-pad" aria-labelledby="notes-heading">
      <h2 id="notes-heading" className="label" style={{ marginBottom: 16 }}>
        {t("detail.notesTitle")}
      </h2>
      <form onSubmit={save} className="stack">
        <div className="field">
          <label htmlFor="scan-label" className="field-label">
            {t("detail.label")}
          </label>
          <input
            id="scan-label"
            className="input"
            maxLength={SCAN_LIMITS.labelMaxLength}
            placeholder={t("detail.labelPlaceholder")}
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              setStatus("idle");
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="scan-notes" className="field-label">
            {t("detail.notes")}
          </label>
          <textarea
            id="scan-notes"
            className="textarea"
            maxLength={SCAN_LIMITS.notesMaxLength}
            placeholder={t("detail.notesPlaceholder")}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setStatus("idle");
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!dirty || status === "saving"}
          >
            {status === "saving" && (
              <span
                className="spinner"
                aria-hidden="true"
                style={{ width: 16, height: 16 }}
              />
            )}
            {status === "saving" ? t("detail.saving") : t("detail.save")}
          </button>
          <span aria-live="polite" style={{ fontSize: 13.5 }}>
            {status === "saved" && (
              <span style={{ color: "var(--mild)", fontWeight: 600 }}>
                {t("detail.saved")}
              </span>
            )}
            {status === "error" && (
              <span className="field-error">{t("detail.saveError")}</span>
            )}
          </span>
        </div>
      </form>
    </section>
  );
}

function DeleteButton({
  scanId,
  onDeleted,
}: {
  scanId: string;
  onDeleted: () => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function confirmDelete() {
    setPending(true);
    setError(false);
    const response = await fetch(`/api/scans/${scanId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (response?.ok || response?.status === 404) {
      dialog.current?.close();
      onDeleted();
      return;
    }
    setPending(false);
    setError(true);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm danger-text"
        onClick={() => dialog.current?.showModal()}
      >
        <TrashIcon size={16} />
        {t("detail.delete")}
      </button>
      <dialog ref={dialog} className="dialog" aria-labelledby="delete-title">
        <div className="dialog-body">
          <span
            className="empty-state-icon"
            style={{
              background: "var(--critical-soft)",
              color: "var(--critical)",
              margin: 0,
            }}
          >
            <AlertIcon size={26} />
          </span>
          <h2 id="delete-title" style={{ fontSize: 19, fontWeight: 700 }}>
            {t("detail.deleteTitle")}
          </h2>
          <p className="muted">{t("detail.deleteDesc")}</p>
          {error && <Alert tone="error">{t("detail.deleteError")}</Alert>}
          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => dialog.current?.close()}
              disabled={pending}
            >
              {t("detail.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending && (
                <span
                  className="spinner"
                  aria-hidden="true"
                  style={{ width: 16, height: 16 }}
                />
              )}
              {pending ? t("detail.deleting") : t("detail.confirmDelete")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
