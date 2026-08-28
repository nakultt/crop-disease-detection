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

const ARC_START = -100;
const ARC_END = 100;
const RADIUS = 74;
const CENTER_X = 100;
const CENTER_Y = 92;

/**
 * Severity as a dial, with the level always spelled out.
 *
 * Colour alone would fail for a colour-blind reader and in greyscale print, so
 * the label, the numeric range and the needle position all carry the value.
 */
export default function SeverityGauge({
  level,
  range,
  probability,
  distribution,
  healthy,
}: SeverityGaugeProps) {
  const levels = distribution.map((d) => d.className);
  const index = Math.max(0, levels.indexOf(level));

  // Interpolate across bins so the needle reflects the whole distribution
  // rather than snapping between four fixed positions.
  const expected = distribution.reduce(
    (sum, d, i) => sum + i * d.probability,
    0,
  );
  const fraction = levels.length > 1 ? expected / (levels.length - 1) : 0;
  const targetAngle = ARC_START + (ARC_END - ARC_START) * fraction;

  // Animate from rest so the needle sweeps in rather than appearing placed.
  const [angle, setAngle] = useState(ARC_START);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAngle(targetAngle));
    return () => cancelAnimationFrame(frame);
  }, [targetAngle]);

  if (healthy) {
    return (
      <section className="card card-pad" aria-labelledby="severity-heading">
        <h2 id="severity-heading" className="label">
          Severity
        </h2>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--mild-soft)",
            color: "var(--mild)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flex: "none" }}
          >
            <circle cx="10" cy="10" r="7.5" />
            <path d="m6.5 10.2 2.4 2.3 4.6-4.8" />
          </svg>
          <p style={{ fontSize: 13.5, color: "var(--text)" }}>
            No disease detected, so there is no infection severity to report.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="card card-pad"
      aria-labelledby="severity-heading"
      data-severity={level}
    >
      <h2 id="severity-heading" className="label">
        Infection severity
      </h2>

      <div style={{ display: "grid", placeItems: "center", marginTop: 6 }}>
        <svg
          viewBox="0 0 200 118"
          width="100%"
          style={{ maxWidth: 240 }}
          role="img"
          aria-label={`Severity ${level}, ${range} of leaf tissue affected, at ${(probability * 100).toFixed(0)} percent confidence.`}
        >
          <path
            d={arcPath(ARC_START, ARC_END)}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={13}
            strokeLinecap="round"
          />
          {distribution.map((bin, i) => {
            const segStart =
              ARC_START + ((ARC_END - ARC_START) * i) / distribution.length;
            const segEnd =
              ARC_START +
              ((ARC_END - ARC_START) * (i + 1)) / distribution.length;
            return (
              <path
                key={bin.className}
                d={arcPath(segStart + 1.5, segEnd - 1.5)}
                fill="none"
                stroke={severityColor(bin.className)}
                strokeWidth={13}
                strokeLinecap="round"
                opacity={i === index ? 1 : 0.2}
                style={{ transition: "opacity var(--ease-in-out)" }}
              />
            );
          })}

          <g
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
              transition: "transform var(--ease-spring)",
            }}
          >
            <line
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={CENTER_X}
              y2={CENTER_Y - RADIUS + 16}
              stroke="var(--text)"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </g>
          <circle cx={CENTER_X} cy={CENTER_Y} r={5} fill="var(--text)" />
          <circle cx={CENTER_X} cy={CENTER_Y} r={2} fill="var(--surface)" />
        </svg>

        <div style={{ textAlign: "center", marginTop: -6 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 660,
              letterSpacing: "-0.015em",
              color: "var(--sev)",
            }}
          >
            {level}
          </div>
          <div className="dim tnum" style={{ fontSize: 12.5, marginTop: 1 }}>
            {range} of leaf tissue · {(probability * 100).toFixed(0)}%
            confidence
          </div>
        </div>
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: "16px 0 0",
          padding: 0,
          display: "grid",
          gap: 6,
        }}
      >
        {distribution.map((bin) => (
          <li
            key={bin.className}
            style={{
              display: "grid",
              gridTemplateColumns: "68px 1fr 40px",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: bin.className === level ? 620 : 460,
                color:
                  bin.className === level
                    ? severityColor(bin.className)
                    : "var(--text-2)",
              }}
            >
              {bin.className}
            </span>
            <span className="meter" style={{ height: 5 }}>
              <i
                style={{
                  width: `${bin.probability * 100}%`,
                  background: severityColor(bin.className),
                  opacity: bin.className === level ? 1 : 0.4,
                }}
              />
            </span>
            <span
              className="tnum dim"
              style={{ fontSize: 11.5, textAlign: "right" }}
            >
              {(bin.probability * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>

      <p
        className="dim"
        style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.45 }}
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

/** Arc from `startDeg` to `endDeg`, measured from straight up, clockwise. */
function arcPath(startDeg: number, endDeg: number): string {
  const p0 = polar(startDeg);
  const p1 = polar(endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}

function polar(degrees: number): { x: number; y: number } {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: CENTER_X + RADIUS * Math.cos(radians),
    y: CENTER_Y + RADIUS * Math.sin(radians),
  };
}
