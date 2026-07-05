"use client";

import { useEffect, useState } from "react";
import { SEVERITY_COLORS } from "../lib/labels";

interface SeverityGaugeProps {
  level: string;
  confidence: number;
  distribution: Array<{ level: string; confidence: number }>;
}

export default function SeverityGauge({ level, confidence, distribution }: SeverityGaugeProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Map severity to angle (0 = left, 180 = right)
  const levelAngles: Record<string, number> = {
    Mild: 22.5,
    Moderate: 67.5,
    Severe: 112.5,
    Critical: 157.5,
  };

  const needleAngle = animated ? (levelAngles[level] ?? 90) : 0;
  const color = SEVERITY_COLORS[level] ?? "#fff";

  // SVG arc parameters
  const cx = 100;
  const cy = 95;
  const r = 70;

  // Create arc segments for each severity level
  const segments = [
    { label: "Mild", startAngle: 180, endAngle: 225, color: SEVERITY_COLORS.Mild },
    { label: "Moderate", startAngle: 225, endAngle: 270, color: SEVERITY_COLORS.Moderate },
    { label: "Severe", startAngle: 270, endAngle: 315, color: SEVERITY_COLORS.Severe },
    { label: "Critical", startAngle: 315, endAngle: 360, color: SEVERITY_COLORS.Critical },
  ];

  function arcPath(startDeg: number, endDeg: number, radius: number): string {
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  return (
    <div className="glass-card animate-fade-in animate-delay-1" style={{ padding: "24px" }} id="severity-gauge">
      <p className="section-heading">Severity Gauge</p>

      <div className="severity-gauge-container">
        <svg viewBox="0 0 200 110" style={{ width: "100%", height: "100%" }}>
          {/* Arc Segments */}
          {segments.map((seg) => (
            <path
              key={seg.label}
              d={arcPath(seg.startAngle, seg.endAngle, r)}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeLinecap="round"
              opacity={seg.label === level ? 1 : 0.25}
              style={{ transition: "opacity 0.5s" }}
            />
          ))}

          {/* Needle */}
          <g
            className="severity-needle"
            style={{
              transform: `rotate(${needleAngle}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
            }}
          >
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - r + 18}
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r="6" fill={color} />
            <circle cx={cx} cy={cy} r="3" fill="var(--bg-primary)" />
          </g>
        </svg>
      </div>

      {/* Severity Level Display */}
      <div style={{ textAlign: "center", marginTop: "8px" }}>
        <span style={{
          fontSize: "1.4rem",
          fontWeight: 800,
          color,
          letterSpacing: "0.02em",
        }}>
          {level}
        </span>
        <span style={{
          fontSize: "0.85rem",
          color: "var(--text-muted)",
          marginLeft: "8px",
        }}>
          ({(confidence * 100).toFixed(1)}%)
        </span>
      </div>

      {/* Distribution Bars */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "6px",
        marginTop: "16px",
      }}>
        {distribution.map((d) => (
          <div key={d.level} style={{ textAlign: "center" }}>
            <div style={{
              height: "4px",
              borderRadius: "2px",
              background: `rgba(${d.level === "Mild" ? "74,222,128" : d.level === "Moderate" ? "250,204,21" : d.level === "Severe" ? "249,115,22" : "239,68,68"}, 0.2)`,
              overflow: "hidden",
              marginBottom: "4px",
            }}>
              <div style={{
                height: "100%",
                width: `${Math.round(d.confidence * 100)}%`,
                background: SEVERITY_COLORS[d.level],
                borderRadius: "2px",
                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }} />
            </div>
            <span style={{
              fontSize: "0.6rem",
              color: d.level === level ? SEVERITY_COLORS[d.level] : "var(--text-muted)",
              fontWeight: d.level === level ? 700 : 400,
            }}>
              {d.level}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
