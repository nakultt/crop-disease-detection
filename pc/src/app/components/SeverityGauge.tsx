"use client";

import { useLanguage } from "../lib/i18n/LanguageContext";
import { severityColor, severityLabel } from "../lib/severity";

interface SeverityBin {
  className: string;
  probability: number;
}

interface SeverityGaugeProps {
  level: string;
  range: string;
  probability: number;
  distribution: SeverityBin[];
  /** Severity is meaningless for a healthy leaf; say so instead of drawing a scale. */
  healthy: boolean;
}

/**
 * Severity as a labelled scale plus the full distribution. The level is always
 * spelled out, so colour is never the only carrier of meaning.
 */
export default function SeverityGauge({
  level,
  range,
  probability,
  distribution,
  healthy,
}: SeverityGaugeProps) {
  const { t } = useLanguage();

  if (healthy) {
    return (
      <section className="card card-pad" aria-labelledby="severity-heading">
        <h2
          id="severity-heading"
          className="label"
          style={{ marginBottom: 16 }}
        >
          {t("sev.title")}
        </h2>
        <div className="alert alert-success">
          <svg
            width="22"
            height="22"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="7.5" />
            <path d="m6.5 10.2 2.4 2.3 4.6-4.8" />
          </svg>
          <p style={{ fontSize: 14.5, fontWeight: 500 }}>{t("sev.healthy")}</p>
        </div>
      </section>
    );
  }

  // Position along the scale reflects the whole distribution (its expected
  // level), not just the arg-max, so a 51/49 split does not look decisive.
  const expected = distribution.reduce(
    (sum, bin, i) => sum + i * bin.probability,
    0,
  );
  const fraction =
    distribution.length > 1 ? expected / (distribution.length - 1) : 0;
  const pct = Math.max(6, Math.min(100, fraction * 100));

  return (
    <section
      className="card card-pad"
      aria-labelledby="severity-heading"
      data-severity={level}
    >
      <h2 id="severity-heading" className="label" style={{ marginBottom: 20 }}>
        {t("sev.title")}
      </h2>

      <div
        style={{
          padding: 20,
          borderRadius: "var(--radius-xl)",
          background: "var(--surface-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {/* Level text stays in ink: the moderate/severe hues fall below
              text contrast on light surfaces. The dot carries the colour. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.015em",
            }}
          >
            <span
              aria-hidden="true"
              className="dot"
              style={{ width: 14, height: 14, color: "var(--sev)" }}
            />
            {severityLabel(level, t)}
          </div>
          <div className="dim tnum" style={{ fontSize: 13.5, fontWeight: 600 }}>
            {range} {t("sev.affected")} · {(probability * 100).toFixed(0)}%
          </div>
        </div>

        {/* biome-ignore lint/a11y/useSemanticElements: a native <meter> cannot take the severity colour ramp or the rounded track across browsers; the ARIA meter role conveys the same value. */}
        <div
          role="meter"
          aria-label={t("sev.title")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={`${severityLabel(level, t)}, ${range}`}
          style={{
            position: "relative",
            height: 12,
            borderRadius: "var(--radius-full)",
            background: "var(--border)",
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0 auto 0 0",
              width: `${pct}%`,
              background: "var(--sev)",
              borderRadius: "var(--radius-full)",
              transition: "width var(--ease-spring)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--text-3)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <span>{t("sev.mild")}</span>
          <span>{t("sev.critical")}</span>
        </div>
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: "28px 0 0",
          padding: 0,
          display: "grid",
          gridTemplateColumns: "max-content minmax(48px, 1fr) auto",
          gap: "14px 12px",
        }}
      >
        {distribution.map((bin) => {
          const current = bin.className === level;
          return (
            <li
              key={bin.className}
              style={{
                display: "grid",
                gridColumn: "1 / -1",
                gridTemplateColumns: "subgrid",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: current ? 700 : 500,
                  color: current ? "var(--text)" : "var(--text-2)",
                }}
              >
                {severityLabel(bin.className, t)}
              </span>
              <span className="meter" style={{ height: 6 }}>
                <i
                  style={{
                    width: `${bin.probability * 100}%`,
                    background: severityColor(bin.className),
                    opacity: current ? 1 : 0.3,
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
          );
        })}
      </ul>

      <p
        className="dim"
        style={{ fontSize: 12, marginTop: 24, lineHeight: 1.5 }}
      >
        {t("sev.note")}
      </p>
    </section>
  );
}
