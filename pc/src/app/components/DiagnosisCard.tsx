"use client";

import type { PredictionResult } from "../lib/inference";
import { conditionOf, cropOf, displayName } from "../lib/manifest";

interface DiagnosisCardProps {
  result: PredictionResult;
  /** Which alternative the user is currently inspecting, if any. */
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * The diagnosis, with its uncertainty made unmissable.
 *
 * A top-1 label alone invites a confident misread. The runners-up are always
 * visible, and a low-confidence result says so in words rather than leaving the
 * reader to interpret a bar.
 */
export default function DiagnosisCard({
  result,
  selectedIndex,
  onSelect,
}: DiagnosisCardProps) {
  const { disease } = result;
  const confidence = disease.probability;
  const runnerUp = disease.topK[1];

  // "Confident" needs both a high top-1 and clear separation from second place;
  // 0.55 against a 0.45 runner-up is not a diagnosis, it is a coin toss.
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
    <section className="card card-pad" aria-labelledby="diagnosis-heading">
      <h2 id="diagnosis-heading" className="label">
        Diagnosis
      </h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          marginTop: 10,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            flex: "none",
            borderRadius: "var(--radius-full)",
            background: disease.healthy
              ? "var(--mild-soft)"
              : "var(--accent-soft)",
            color: disease.healthy ? "var(--mild)" : "var(--accent)",
          }}
        >
          {disease.healthy ? <LeafIcon /> : <ScopeIcon />}
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="dim" style={{ fontSize: 12 }}>
            {cropOf(disease.className)}
          </div>
          <h3
            style={{
              fontSize: 21,
              fontWeight: 640,
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
            }}
          >
            {conditionOf(disease.className)}
          </h3>
        </div>

        <div style={{ textAlign: "right", flex: "none" }}>
          <div
            className="tnum"
            style={{
              fontSize: 25,
              fontWeight: 660,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {(confidence * 100).toFixed(1)}
            <span style={{ fontSize: 14, fontWeight: 500 }}>%</span>
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
            confidence
          </div>
        </div>
      </div>

      <div className="meter" style={{ marginTop: 14 }}>
        <i style={{ width: `${confidence * 100}%` }} />
      </div>

      {toneCopy && (
        <p
          style={{
            fontSize: 13,
            marginTop: 10,
            padding: "9px 11px",
            borderRadius: "var(--radius-sm)",
            background:
              tone === "low" ? "var(--critical-soft)" : "var(--moderate-soft)",
            color: tone === "low" ? "var(--critical)" : "var(--moderate)",
          }}
        >
          {toneCopy}
        </p>
      )}

      <div style={{ marginTop: 18 }}>
        <h3 className="label" style={{ marginBottom: 8 }}>
          All candidates
        </h3>
        <p className="dim" style={{ fontSize: 12, marginBottom: 10 }}>
          Select one to see the heatmap for that class.
        </p>

        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: 3,
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
                    gap: "2px 10px",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${active ? "var(--accent)" : "transparent"}`,
                    background: active ? "var(--accent-soft)" : "transparent",
                    textAlign: "left",
                    transition:
                      "background var(--ease-out), border-color var(--ease-out)",
                  }}
                  onMouseEnter={(event) => {
                    if (!active)
                      event.currentTarget.style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(event) => {
                    if (!active)
                      event.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: active ? 600 : 460,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayName(candidate.className)}
                  </span>
                  <span
                    className="tnum dim"
                    style={{ fontSize: 12.5, fontWeight: 560 }}
                  >
                    {(candidate.probability * 100).toFixed(1)}%
                  </span>
                  <span
                    className="meter"
                    style={{ gridColumn: "1 / -1", height: 3, marginTop: 3 }}
                  >
                    <i
                      style={{
                        width: `${candidate.probability * 100}%`,
                        background: active
                          ? "var(--accent)"
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

      <p className="dim" style={{ fontSize: 11.5, marginTop: 14 }}>
        Analysed on-device in {result.inferenceMs.toFixed(0)} ms.
      </p>
    </section>
  );
}

function LeafIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 16c0-6 4-10 12-11 0 8-4 12-9 12a5 5 0 0 1-3-1Z" />
      <path d="M4 16c2-4 5-6.5 9-8" />
    </svg>
  );
}

function ScopeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4" />
      <path d="M9 6.5v5M6.5 9h5" />
    </svg>
  );
}
