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
      <h2 id="advice-heading" className="label">
        {healthy ? "Keeping it healthy" : "Suggested treatment"}
      </h2>

      {!trustworthy && (
        <p
          style={{
            fontSize: 13,
            margin: "10px 0 0",
            padding: "9px 11px",
            borderRadius: "var(--radius-sm)",
            background: "var(--moderate-soft)",
            color: "var(--moderate)",
          }}
        >
          Shown for completeness only. The current model is untrained, so the
          diagnosis these steps respond to is not real.
        </p>
      )}

      <ol
        style={{
          listStyle: "none",
          margin: "12px 0 0",
          padding: 0,
          display: "grid",
          gap: 2,
          counterReset: "step",
        }}
      >
        {recommendations.map((recommendation) => (
          <li
            key={recommendation.text}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 10,
              alignItems: "flex-start",
              padding: "9px 10px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                marginTop: 7,
                borderRadius: "50%",
                background: URGENCY_COLOR[recommendation.urgency],
                flex: "none",
              }}
            />
            <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              {recommendation.text}
            </span>
          </li>
        ))}
      </ol>

      {!healthy && (
        <p
          className="dim"
          style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.45 }}
        >
          General guidance only. Confirm the diagnosis and any chemical
          treatment with a local agricultural extension service before applying
          it — product availability, dosage and regulations vary by region.
        </p>
      )}
    </section>
  );
}
