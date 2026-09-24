"use client";

import { useMemo } from "react";
import { useLanguage } from "../lib/i18n/LanguageContext";
import {
  getRecommendations,
  type Recommendation,
} from "../lib/recommendations";

interface RecommendationPanelProps {
  diseaseClass: string;
  severity: string;
  healthy: boolean;
  /** Flag advice as not actionable when the model itself is unreliable. */
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
  const { t } = useLanguage();
  const recommendations = useMemo(
    () => getRecommendations(diseaseClass, severity, t),
    [diseaseClass, severity, t],
  );

  return (
    <section className="card card-pad" aria-labelledby="advice-heading">
      <h2 id="advice-heading" className="label" style={{ marginBottom: 20 }}>
        {healthy ? t("rec.titleHealthy") : t("rec.titleDisease")}
      </h2>

      {!trustworthy && (
        <p className="alert alert-warning" style={{ marginBottom: 20 }}>
          {t("rec.warning")}
        </p>
      )}

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 10,
        }}
      >
        {recommendations.map((recommendation) => (
          <li key={recommendation.text} className="recommendation">
            <span
              aria-hidden="true"
              className="recommendation-dot"
              style={{
                background: URGENCY_COLOR[recommendation.urgency],
                boxShadow: `0 0 0 4px color-mix(in srgb, ${URGENCY_COLOR[recommendation.urgency]} 20%, transparent)`,
              }}
            />
            <span
              style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--text)" }}
            >
              {recommendation.text}
            </span>
          </li>
        ))}
      </ol>

      {!healthy && (
        <p
          className="dim"
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: "var(--radius-md)",
            border: "1.5px dashed var(--border-strong)",
            fontSize: 12.5,
            lineHeight: 1.5,
            fontWeight: 500,
          }}
        >
          {t("rec.disclaimer")}
        </p>
      )}
    </section>
  );
}
