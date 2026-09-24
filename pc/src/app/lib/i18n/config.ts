/**
 * Supported interface languages.
 *
 * The chosen language is kept in a cookie rather than only in localStorage so
 * the server renders pages in it from the first byte — no flash of English,
 * no hydration mismatch, and correct `<html lang>` for screen readers.
 */

export const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export const LANGUAGE_COOKIE = "plantguard-language";

/** One year; the choice is a preference, not a session. */
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const CODES = new Set<string>(LANGUAGES.map((language) => language.code));

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && CODES.has(value);
}

/**
 * Pick the best supported language from an `Accept-Language` header, e.g.
 * `ta-IN,ta;q=0.9,en-GB;q=0.8` → `ta`. Falls back to English.
 */
export function negotiateLanguage(
  header: string | null | undefined,
): LanguageCode {
  if (!header) return DEFAULT_LANGUAGE;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return {
        base: tag.toLowerCase().split("-")[0],
        weight: Number.isFinite(weight) ? weight : 0,
      };
    })
    .filter((entry) => entry.base && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { base } of ranked) {
    if (isLanguageCode(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}
