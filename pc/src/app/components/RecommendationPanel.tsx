"use client";

import { useMemo } from "react";
import {
  getRecommendations,
  type Recommendation,
} from "../lib/recommendations";

interface RecommendationPanelProps {
  diseaseClass: string;
  severity: string;
  healthy: boolean;
  /** Suppress actionable advice when the model itself is unreliable. */
  trustworthy: boolean;
}

const URGENCY_COLOR: Record<Recommendation["urgency"], string> = {
  info: "var(--mild)",
  warning: "var(--moderate)",
  critical: "var(--critical)",
};

export default function RecommendationPanel({
  diseaseClass,
  severity,
  healthy,
  trustworthy,
}: RecommendationPanelProps) {
  const recommendations = useMemo(
    () => getRecommendations(diseaseClass, severity),
    [diseaseClass, severity],
  );

  return (
    <section className="card card-pad" aria-labelledby="advice-heading">
      <h2 id="advice-heading" className="label" style={{ marginBottom: 20 }}>
        {healthy ? "Keeping it healthy" : "Suggested treatment"}
      </h2>

      {!trustworthy && (
        <p
          style={{
            fontSize: 14,
            margin: "0 0 20px 0",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            background: "var(--moderate-soft)",
            color: "var(--moderate)",
            fontWeight: 500,
          }}
        >
          Shown for completeness only. The current model is untrained, so the
          diagnosis these steps respond to is not real.
        </p>
      )}

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 10,
          counterReset: "step",
        }}
      >
        {recommendations.map((recommendation) => (
          <li
            key={recommendation.text}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 14,
              alignItems: "flex-start",
              padding: "16px",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-2)",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                marginTop: 6,
                borderRadius: "50%",
                background: URGENCY_COLOR[recommendation.urgency],
                flex: "none",
                boxShadow: `0 0 0 4px color-mix(in srgb, ${URGENCY_COLOR[recommendation.urgency]} 20%, transparent)`,
              }}
            />
            <span style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--text)" }}>
              {recommendation.text}
            </span>
          </li>
        ))}
      </ol>

      {!healthy && (
        <div style={{ marginTop: 24, padding: "16px", borderRadius: "var(--radius-md)", border: "1.5px dashed var(--border-strong)" }}>
          <p
            className="dim"
            style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 500 }}
          >
            General guidance only. Confirm the diagnosis and any chemical
            treatment with a local agricultural extension service before applying
            it — product availability, dosage and regulations vary by region.
          </p>
        </div>
      )}
    </section>
  );
}
