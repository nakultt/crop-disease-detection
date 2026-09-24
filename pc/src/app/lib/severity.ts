import type { Translate, TranslationKey } from "./i18n/types";

/**
 * Severity levels are status colours with reserved meaning. They are never
 * shown without the level's name beside them: Mild and Moderate in particular
 * are hard to tell apart with red-green colour blindness.
 */

const LEVEL_KEYS: Record<string, TranslationKey> = {
  Mild: "sev.mild",
  Moderate: "sev.moderate",
  Severe: "sev.severe",
  Critical: "sev.critical",
};

export const SEVERITY_ORDER = ["Mild", "Moderate", "Severe", "Critical"];

/** The model's level names ("Mild", …) in the reader's language. */
export function severityLabel(level: string, t: Translate): string {
  const key = LEVEL_KEYS[level];
  return key ? t(key) : level;
}

export function severityColor(level: string): string {
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
