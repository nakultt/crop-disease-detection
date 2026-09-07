"use client";

import type { PredictionResult } from "../lib/inference";
import { conditionOf, cropOf, displayName } from "../lib/manifest";

interface DiagnosisCardProps {
  result: PredictionResult;
  /** Which alternative the user is currently inspecting, if any. */
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function DiagnosisCard({
  result,
  selectedIndex,
  onSelect,
}: DiagnosisCardProps) {
  const { disease } = result;
  const confidence = disease.probability;
  const runnerUp = disease.topK[1];

  const margin = runnerUp ? confidence - runnerUp.probability : confidence;
  const tone =
    confidence >= 0.85 && margin >= 0.3
      ? "high"
      : confidence >= 0.6
        ? "medium"
        : "low";

  const toneCopy = {
    high: null,
    medium: "Moderate confidence — check the runners-up below before acting.",
    low: "Low confidence. The model is not distinguishing these classes well on this image; try a sharper, closer, better-lit photo of a single leaf.",
  }[tone];

  return (
    <section className="card card-pad" aria-labelledby="diagnosis-heading" style={{ borderTop: "6px solid var(--primary)" }}>
      <h2 id="diagnosis-heading" className="label" style={{ marginBottom: 20 }}>
        Detection Result
      </h2>

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="dim" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 660 }}>
            {cropOf(disease.className)}
          </div>
          <h3
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              marginTop: 6,
              color: "var(--text)",
            }}
          >
            {conditionOf(disease.className)}
          </h3>
        </div>

        <div style={{ textAlign: "center", flex: "none", background: "var(--surface-2)", borderRadius: "var(--radius-xl)", padding: "16px 20px", minWidth: 110, boxShadow: "var(--shadow-1)" }}>
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
          <div className="dim" style={{ fontSize: 12, marginTop: 8, fontWeight: 660, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Confidence
          </div>
        </div>
      </div>

      {toneCopy && (
        <p
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
          {toneCopy}
        </p>
      )}

      <div style={{ marginTop: 36 }}>
        <h3 className="label" style={{ marginBottom: 12 }}>
          Other possibilities
        </h3>

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
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    gap: "6px 12px",
                    padding: "14px 18px",
                    borderRadius: "var(--radius-md)",
                    border: `1.5px solid ${active ? "var(--primary)" : "transparent"}`,
                    background: active ? "var(--primary-soft)" : "var(--surface-2)",
                    textAlign: "left",
                    transition:
                      "background var(--ease-out), border-color var(--ease-out), transform var(--ease-out)",
                    transform: active ? "scale(1.01)" : "scale(1)",
                  }}
                  onMouseEnter={(event) => {
                    if (!active)
                      event.currentTarget.style.background = "var(--surface-3)";
                  }}
                  onMouseLeave={(event) => {
                    if (!active)
                      event.currentTarget.style.background = "var(--surface-2)";
                  }}
                >
                  <span
                    style={{
                      fontSize: 14.5,
                      fontWeight: active ? 600 : 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: active ? "var(--primary-hover)" : "var(--text)",
                    }}
                  >
                    {displayName(candidate.className)}
                  </span>
                  <span
                    className="tnum dim"
                    style={{ fontSize: 14.5, fontWeight: 600, color: active ? "var(--primary)" : "var(--text-3)" }}
                  >
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

      <p className="dim" style={{ fontSize: 12, marginTop: 24, textAlign: "right" }}>
        Analysed on-device in {result.inferenceMs.toFixed(0)} ms.
      </p>
    </section>
  );
}
