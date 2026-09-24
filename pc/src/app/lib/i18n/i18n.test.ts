import { describe, expect, it } from "vitest";
import { isLanguageCode, LANGUAGES, negotiateLanguage } from "./config";
import { loadDictionary, translate } from "./dictionary";
import en from "./locales/en";
import type { TranslationKey, Translations } from "./types";

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort();

describe("negotiateLanguage", () => {
  it("picks the highest-weighted supported language", () => {
    expect(negotiateLanguage("ta-IN,ta;q=0.9,en-GB;q=0.8")).toBe("ta");
    expect(negotiateLanguage("fr-FR,fr;q=0.9,hi;q=0.5")).toBe("hi");
  });

  it("honours q-values rather than order", () => {
    expect(negotiateLanguage("en;q=0.2,bn;q=0.9")).toBe("bn");
  });

  it("falls back to English", () => {
    expect(negotiateLanguage("de-DE,de;q=0.9")).toBe("en");
    expect(negotiateLanguage("")).toBe("en");
    expect(negotiateLanguage(null)).toBe("en");
    expect(negotiateLanguage("ta;q=0")).toBe("en");
  });
});

describe("isLanguageCode", () => {
  it("accepts only supported codes", () => {
    expect(isLanguageCode("ml")).toBe(true);
    expect(isLanguageCode("xx")).toBe(false);
    expect(isLanguageCode(undefined)).toBe(false);
  });
});

describe("translate", () => {
  it("substitutes positional arguments, repeatedly", () => {
    const dictionary = { ...en, "history.pageOf": "{0} of {1}; again {0}" };
    expect(translate(dictionary, "history.pageOf", [2, 5])).toBe(
      "2 of 5; again 2",
    );
  });

  it("returns the key for an unknown entry rather than throwing", () => {
    expect(translate(en, "nope.missing" as TranslationKey)).toBe(
      "nope.missing",
    );
  });
});

describe("locales", () => {
  it.each(LANGUAGES.filter((l) => l.code !== "en").map((l) => l.code))(
    "%s only uses keys that exist in English, with matching placeholders",
    async (code) => {
      const module = (await import(`./locales/${code}.ts`)) as {
        default: Translations;
      };
      for (const [key, text] of Object.entries(module.default)) {
        expect(en, `unknown key ${key}`).toHaveProperty(key);
        expect(
          placeholders(text as string),
          `placeholders in ${code}:${key}`,
        ).toEqual(placeholders(en[key as TranslationKey]));
      }
    },
  );

  it.each(LANGUAGES.filter((l) => l.code !== "en").map((l) => l.code))(
    "%s translates every user-facing key (the admin console is English-only)",
    async (code) => {
      const module = (await import(`./locales/${code}.ts`)) as {
        default: Translations;
      };
      const missing = Object.keys(en).filter(
        (key) => !key.startsWith("admin.") && !(key in module.default),
      );
      expect(missing, `untranslated in ${code}`).toEqual([]);
    },
  );

  it("merges a locale over English so no key is ever missing", async () => {
    const tamil = await loadDictionary("ta");
    for (const key of Object.keys(en)) {
      expect(typeof tamil[key as TranslationKey]).toBe("string");
    }
  });
});
