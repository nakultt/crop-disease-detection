"use client";

import type { PredictionResult } from "../lib/inference";
import { getDisplayName, getPlantName, isHealthy, SEVERITY_COLORS, SEVERITY_CSS_CLASS, SEVERITY_RANGES } from "../lib/labels";

interface ResultCardProps {
  result: PredictionResult;
}

export default function ResultCard({ result }: ResultCardProps) {
  const { disease, severity } = result;
  const displayName = getDisplayName(disease.className);
  const plantName = getPlantName(disease.className);
  const healthy = isHealthy(disease.className);
  const severityColor = SEVERITY_COLORS[severity.level];
  const severityCss = SEVERITY_CSS_CLASS[severity.level];

  return (
    <div className="glass-card animate-fade-in" style={{ padding: "24px" }} id="result-card">
      {/* Disease Section */}
      <div style={{ marginBottom: "20px" }}>
        <p className="section-heading">Detected Disease</p>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <span style={{ fontSize: "1.8rem" }}>
            {healthy ? "✅" : "🔬"}
          </span>
          <div>
            <h2 style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: healthy ? "var(--severity-mild)" : "var(--text-primary)",
              margin: 0,
              lineHeight: 1.3,
            }}>
              {displayName}
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
              Plant: {plantName}
            </p>
          </div>
        </div>

        {/* Confidence Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="confidence-bar" style={{ flex: 1 }}>
            <div
              className="confidence-fill"
              style={{ width: `${Math.round(disease.confidence * 100)}%` }}
            />
          </div>
          <span style={{
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "var(--emerald-400)",
            minWidth: "52px",
            textAlign: "right",
          }}>
            {(disease.confidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{
        height: "1px",
        background: "var(--border-subtle)",
        margin: "16px 0",
      }} />

      {/* Severity Section */}
      <div style={{ marginBottom: "16px" }}>
        <p className="section-heading">Infection Severity</p>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className={`severity-badge ${severityCss}`}>
            <span className="pulse-dot" style={{ backgroundColor: severityColor }} />
            {severity.level}
          </span>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {SEVERITY_RANGES[severity.level]} infected area
          </span>
          <span style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: severityColor,
            marginLeft: "auto",
          }}>
            {(severity.confidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Top-K Disease Predictions */}
      {disease.topK.length > 1 && (
        <div>
          <p className="section-heading" style={{ marginTop: "16px" }}>Other Possibilities</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {disease.topK.slice(1, 4).map((pred) => (
              <div
                key={pred.index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                }}
              >
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {getDisplayName(pred.className)}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
                  {(pred.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
