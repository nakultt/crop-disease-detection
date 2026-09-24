import type { LanguageCode } from "./config";
import en from "./locales/en";
import type { Dictionary, TranslationKey, Translations } from "./types";

/**
 * Locale loading. Each non-English locale is its own chunk, so a visitor
 * downloads the strings for one language rather than all eight. English is
 * always present as the fallback for keys a locale has not translated yet.
 */

const LOADERS: Record<
  Exclude<LanguageCode, "en">,
  () => Promise<{ default: Translations }>
> = {
  ta: () => import("./locales/ta"),
  hi: () => import("./locales/hi"),
  te: () => import("./locales/te"),
  kn: () => import("./locales/kn"),
  ml: () => import("./locales/ml"),
  mr: () => import("./locales/mr"),
  bn: () => import("./locales/bn"),
};

export const englishDictionary: Dictionary = en;

export async function loadDictionary(code: LanguageCode): Promise<Dictionary> {
  if (code === "en") return en;
  const { default: translated } = await LOADERS[code]();
  return { ...en, ...translated };
}

/** Look up `key` and substitute `{0}`, `{1}`, … with `args`. */
export function translate(
  dictionary: Dictionary,
  key: TranslationKey,
  args: readonly (string | number)[] = [],
): string {
  let text = dictionary[key] ?? en[key] ?? key;
  args.forEach((arg, index) => {
    text = text.replaceAll(`{${index}}`, String(arg));
  });
  return text;
}
