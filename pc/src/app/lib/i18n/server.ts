import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import {
  isLanguageCode,
  LANGUAGE_COOKIE,
  type LanguageCode,
  negotiateLanguage,
} from "./config";
import { loadDictionary, translate } from "./dictionary";
import type { Translate } from "./types";

/** The visitor's language: their saved choice, else their browser's preference. */
export const getLanguage = cache(async (): Promise<LanguageCode> => {
  const saved = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  if (isLanguageCode(saved)) return saved;
  return negotiateLanguage((await headers()).get("accept-language"));
});

export const getDictionary = cache(async () =>
  loadDictionary(await getLanguage()),
);

/** `t()` for Server Components. */
export async function getTranslator(): Promise<Translate> {
  const dictionary = await getDictionary();
  return (key, ...args) => translate(dictionary, key, args);
}
