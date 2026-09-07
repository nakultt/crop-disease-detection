"use client";

import { useEffect, useState } from "react";
import type { ClassScore } from "../lib/inference";

interface SeverityGaugeProps {
  level: string;
  range: string;
  probability: number;
  distribution: ClassScore[];
  /** Severity is meaningless for a healthy leaf; say so instead of drawing a dial. */
  healthy: boolean;
}

export default function SeverityGauge({
  level,
  range,
  probability,
  distribution,
  healthy,
}: SeverityGaugeProps) {
  if (healthy) {
    return (
      <section className="card card-pad" aria-labelledby="severity-heading">
        <h2 id="severity-heading" className="label" style={{ marginBottom: 16 }}>
          Severity
        </h2>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            background: "var(--mild-soft)",
            color: "var(--mild)",
            border: "1px solid color-mix(in srgb, var(--mild) 20%, transparent)",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flex: "none" }}
          >
            <circle cx="10" cy="10" r="7.5" />
            <path d="m6.5 10.2 2.4 2.3 4.6-4.8" />
          </svg>
          <p style={{ fontSize: 14.5, color: "var(--text)", fontWeight: 500 }}>
            No disease detected. Plant is healthy.
          </p>
        </div>
      </section>
    );
  }

  // Find the exact index for a linear progress scale
  const levels = ["Mild", "Moderate", "Severe", "Critical"];
  const index = Math.max(0, levels.indexOf(level));
  // Default to 10% for mild to ensure there is always a visible bar
  const fraction = Math.max(0.1, index / (levels.length - 1));
  const pct = fraction * 100;

  return (
    <section
      className="card card-pad"
      aria-labelledby="severity-heading"
      data-severity={level}
    >
      <h2 id="severity-heading" className="label" style={{ marginBottom: 20 }}>
        Infection severity
      </h2>

      <div style={{ padding: "20px", borderRadius: "var(--radius-xl)", background: "var(--surface-2)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: "var(--sev)",
            }}
          >
            {level}
          </div>
          <div className="dim tnum" style={{ fontSize: 13.5, fontWeight: 600 }}>
            {range} affected
          </div>
        </div>
        
        {/* Visual Scale */}
        <div style={{ position: "relative", height: 12, borderRadius: "var(--radius-full)", background: "var(--border)", overflow: "hidden", marginBottom: 12 }}>
          <div style={{ 
            position: "absolute", 
            left: 0, 
            top: 0, 
            bottom: 0, 
            width: `${pct}%`, 
            background: "var(--sev)", 
            borderRadius: "var(--radius-full)",
            transition: "width var(--ease-spring)"
          }} />
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <span>Mild</span>
          <span>Critical</span>
        </div>
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: "28px 0 0",
          padding: 0,
          display: "grid",
          gap: 14,
        }}
      >
        {distribution.map((bin) => (
          <li
            key={bin.className}
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr 48px",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 13.5,
                fontWeight: bin.className === level ? 660 : 500,
                color:
                  bin.className === level
                    ? severityColor(bin.className)
                    : "var(--text-2)",
              }}
            >
              {bin.className}
            </span>
            <span className="meter" style={{ height: 6 }}>
              <i
                style={{
                  width: `${bin.probability * 100}%`,
                  background: severityColor(bin.className),
                  opacity: bin.className === level ? 1 : 0.3,
                }}
              />
            </span>
            <span
              className="tnum dim"
              style={{ fontSize: 13.5, textAlign: "right", fontWeight: 600 }}
            >
              {(bin.probability * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>

      <p
        className="dim"
        style={{ fontSize: 12, marginTop: 24, lineHeight: 1.5 }}
      >
        Severity labels are derived from colour segmentation, not agronomist
        annotation. Treat this as an indication, not a measurement.
      </p>
    </section>
  );
}

function severityColor(level: string): string {
  switch (level) {
    case "Mild":
      return "var(--mild)";
    case "Moderate":
      return "var(--moderate)";
    case "Severe":
      return "var(--severe)";
    case "Critical":
      return "var(--critical)";
    default:
      return "var(--text-3)";
  }
}
