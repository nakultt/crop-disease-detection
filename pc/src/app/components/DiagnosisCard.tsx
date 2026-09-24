"use client";

import { useLanguage } from "../lib/i18n/LanguageContext";
import type { ClassScore } from "../lib/inference";
import { classLabel, conditionLabel, cropLabel } from "../lib/labels";

interface DiagnosisCardProps {
  disease: ClassScore & { healthy: boolean; topK: ClassScore[] };
  /** Which alternative the user is currently inspecting, if any. */
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Omitted for saved scans, where the timing is not interesting. */
  inferenceMs?: number;
}

/** "Confident" needs a high top-1 *and* clear separation from second place. */
export function confidenceTone(
  confidence: number,
  runnerUp: number | undefined,
): "high" | "medium" | "low" {
  const margin = runnerUp === undefined ? confidence : confidence - runnerUp;
  if (confidence >= 0.85 && margin >= 0.3) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

/**
 * The diagnosis, with its uncertainty made unmissable. A top-1 label alone
 * invites a confident misread, so the runners-up are always visible, and a
 * shaky result says so in words.
 */
export default function DiagnosisCard({
  disease,
  selectedIndex,
  onSelect,
  inferenceMs,
}: DiagnosisCardProps) {
  const { t } = useLanguage();
  const confidence = disease.probability;
  const tone = confidenceTone(confidence, disease.topK[1]?.probability);

  return (
    <section
      className="card card-pad"
      aria-labelledby="diagnosis-heading"
      style={{
        borderTop: `6px solid ${disease.healthy ? "var(--mild)" : "var(--primary)"}`,
      }}
    >
      <h2 id="diagnosis-heading" className="label" style={{ marginBottom: 20 }}>
        {disease.healthy ? t("diag.healthyTitle") : t("diag.title")}
      </h2>

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 180px" }}>
          <div
            className="dim"
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 650,
            }}
          >
            {cropLabel(disease.className, t)}
          </div>
          <h3
            style={{
              fontSize: "clamp(24px, 4vw, 32px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              marginTop: 6,
              color: "var(--text)",
            }}
          >
            {conditionLabel(disease.className, t)}
          </h3>
        </div>

        <div className="confidence-badge">
          <div
            className="tnum"
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: "var(--primary)",
            }}
          >
            {(confidence * 100).toFixed(1)}
            <span style={{ fontSize: 18, fontWeight: 600 }}>%</span>
          </div>
          <div
            className="dim"
            style={{
              fontSize: 12,
              marginTop: 8,
              fontWeight: 650,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t("diag.confidence")}
          </div>
        </div>
      </div>

      {tone !== "high" && (
        <p
          aria-live="polite"
          style={{
            fontSize: 14,
            marginTop: 24,
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            background:
              tone === "low" ? "var(--critical-soft)" : "var(--moderate-soft)",
            color: tone === "low" ? "var(--critical)" : "var(--moderate)",
            fontWeight: 500,
          }}
        >
          {tone === "low"
            ? t("diag.lowConfidence")
            : t("diag.mediumConfidence")}
        </p>
      )}

      <div style={{ marginTop: 32 }}>
        <h3 className="label" style={{ marginBottom: 6 }}>
          {t("diag.other")}
        </h3>
        <p className="dim" style={{ fontSize: 13, marginBottom: 12 }}>
          {t("diag.selectHint")}
        </p>

        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: 8,
          }}
        >
          {disease.topK.map((candidate) => {
            const active = candidate.index === selectedIndex;
            return (
              <li key={candidate.index}>
                <button
                  type="button"
                  onClick={() => onSelect(candidate.index)}
                  aria-pressed={active}
                  className="candidate"
                >
                  <span className="candidate-name">
                    {classLabel(candidate.className, t)}
                  </span>
                  <span className="tnum candidate-pct">
                    {(candidate.probability * 100).toFixed(1)}%
                  </span>
                  <span
                    className="meter"
                    style={{ gridColumn: "1 / -1", height: 4, marginTop: 4 }}
                  >
                    <i
                      style={{
                        width: `${candidate.probability * 100}%`,
                        background: active
                          ? "var(--primary)"
                          : "var(--border-strong)",
                      }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {inferenceMs !== undefined && (
        <p
          className="dim"
          style={{ fontSize: 12, marginTop: 24, textAlign: "right" }}
        >
          {t("diag.time", inferenceMs.toFixed(0))}
        </p>
      )}
    </section>
  );
}
