"use client";

import type { Recommendation } from "../lib/recommendations";

interface RecommendationPanelProps {
  recommendations: Recommendation[];
}

export default function RecommendationPanel({ recommendations }: RecommendationPanelProps) {
  const urgencyIcons: Record<string, string> = {
    info: "💡",
    warning: "⚠️",
    critical: "🚨",
  };

  const urgencyColors: Record<string, string> = {
    info: "var(--severity-mild)",
    warning: "var(--severity-moderate)",
    critical: "var(--severity-critical)",
  };

  return (
    <div className="glass-card animate-fade-in animate-delay-3" style={{ padding: "24px" }} id="recommendation-panel">
      <p className="section-heading">Treatment Recommendations</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {recommendations.map((rec, idx) => (
          <div key={idx} className="recommendation-item">
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>
              {urgencyIcons[rec.urgency]}
            </span>
            <p style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}>
              {rec.text}
            </p>
          </div>
        ))}
      </div>

      {/* Urgency Legend */}
      <div style={{
        display: "flex",
        gap: "16px",
        marginTop: "16px",
        paddingTop: "12px",
        borderTop: "1px solid var(--border-subtle)",
      }}>
        {Object.entries(urgencyIcons).map(([key, icon]) => (
          <div key={key} style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "0.7rem",
            color: urgencyColors[key],
          }}>
            <span>{icon}</span>
            <span style={{ textTransform: "capitalize" }}>{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
