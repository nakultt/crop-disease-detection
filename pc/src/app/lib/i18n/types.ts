import type en from "./locales/en";

/** Every key the app may translate. A typo is a compile error, not raw text on screen. */
export type TranslationKey = keyof typeof en;

/** A complete set of strings: English plus any translated overrides. */
export type Dictionary = Record<TranslationKey, string>;

/** A locale's translations; untranslated keys fall back to English. */
export type Translations = Partial<Dictionary>;

export type Translate = (
  key: TranslationKey,
  ...args: (string | number)[]
) => string;
