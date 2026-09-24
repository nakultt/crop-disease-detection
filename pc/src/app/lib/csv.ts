/**
 * CSV encoding for exports.
 *
 * Follows RFC 4180 quoting, and neutralises spreadsheet formula injection: a
 * cell beginning with `=`, `+`, `-`, `@`, tab or carriage return is executed
 * as a formula by Excel and Sheets. Notes and labels are free text typed by
 * users, so an exported file must never be able to run one.
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "number"
        ? Number.isFinite(value)
          ? String(value)
          : ""
        : String(value);

  // Numbers are safe as-is (a negative number is data, not a formula).
  if (typeof value !== "number" && FORMULA_TRIGGER.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

/** Header plus rows, CRLF-separated as RFC 4180 specifies. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\r\n");
}
