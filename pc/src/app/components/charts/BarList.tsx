/**
 * Labelled horizontal bars: one row per category, name and value in text
 * ink above a bar whose length carries magnitude. Every value is printed, so
 * nothing depends on hover or on colour, and long names wrap instead of being
 * cut off.
 */

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** Mark colour; defaults to the primary hue. Never used for text. */
  color?: string;
}

export default function BarList({
  items,
  label,
  formatValue = (v) => v.toLocaleString(),
}: {
  items: BarListItem[];
  /** Accessible name for the list. */
  label: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <ul className="bar-list" aria-label={label}>
      {items.map((item) => (
        <li key={item.key} className="bar-list-row">
          <div className="bar-list-top">
            <span className="bar-list-label">
              {item.color && (
                <span
                  aria-hidden="true"
                  className="dot"
                  style={{ color: item.color }}
                />
              )}
              <span>{item.label}</span>
            </span>
            <span className="bar-list-value tnum">
              {formatValue(item.value)}
            </span>
          </div>
          <span className="bar-list-track" aria-hidden="true">
            <i
              style={{
                width: `${(item.value / max) * 100}%`,
                background: item.color ?? "var(--primary)",
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
