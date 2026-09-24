"use client";

import { useState } from "react";
import { useLanguage } from "../../lib/i18n/LanguageContext";

export interface TimePoint {
  /** ISO timestamp for the start of the bucket (UTC). */
  start: string;
  count: number;
  /** The bucket's date, formatted on the server with `shortDate`. */
  label: string;
}

const PLOT_HEIGHT = 120;

/**
 * Counts over time as columns. One series, so one hue and no legend — the
 * card title names it. The latest bucket is emphasised (the story is "now");
 * it and the peak carry direct labels; every column shows its value on hover
 * or keyboard focus; and a table view holds all values for anyone who cannot
 * use the chart.
 */
export default function TimeColumnChart({
  points,
  unit,
  valueHeader,
}: {
  points: TimePoint[];
  unit: "week" | "day";
  valueHeader: string;
}) {
  const { t } = useLanguage();
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(1, ...points.map((p) => p.count));
  const peak = points.reduce(
    (best, p, i) => (p.count > points[best].count ? i : best),
    0,
  );
  const last = points.length - 1;
  // Dense series get every other axis label, so dates never collide.
  const labelEvery = points.length > 10 ? 2 : 1;
  const columns = {
    gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
  };

  const bucketName = (point: TimePoint) =>
    unit === "week" ? t("dash.week", point.label) : point.label;

  return (
    <div>
      <div
        className="column-chart-plot"
        style={{ ...columns, height: PLOT_HEIGHT }}
      >
        {points.map((point, i) => {
          const height =
            point.count === 0
              ? 0
              : Math.max(4, (point.count / max) * PLOT_HEIGHT);
          const labelled = i === last || (i === peak && point.count > 0);
          return (
            <button
              key={point.start}
              type="button"
              className="column"
              aria-label={`${bucketName(point)}: ${point.count}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              {active === i && (
                <span role="tooltip" className="chart-tooltip">
                  <strong className="tnum">{point.count}</strong>
                  <span>{bucketName(point)}</span>
                </span>
              )}
              {labelled && active !== i && (
                <span
                  className="column-value tnum"
                  style={{ bottom: height + 4 }}
                >
                  {point.count}
                </span>
              )}
              <span
                className="column-bar"
                data-active={active === i || undefined}
                data-current={i === last || undefined}
                style={{ height }}
              />
            </button>
          );
        })}
      </div>
      <div className="column-chart-axis" style={columns} aria-hidden="true">
        {points.map((point, i) => (
          <span key={point.start}>
            {(points.length - 1 - i) % labelEvery === 0 ? point.label : ""}
          </span>
        ))}
      </div>

      <details className="table-view">
        <summary>{t("dash.showTable")}</summary>
        <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th scope="col">
                {unit === "week" ? t("dash.weekOf") : t("admin.day")}
              </th>
              <th scope="col" style={{ textAlign: "right" }}>
                {valueHeader}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.start}>
                <td>{point.label}</td>
                <td className="tnum" style={{ textAlign: "right" }}>
                  {point.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
