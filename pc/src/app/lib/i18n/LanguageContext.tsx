"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  isLanguageCode,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  type LanguageCode,
} from "./config";
import { loadDictionary, translate } from "./dictionary";
import type { Dictionary, Translate } from "./types";

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => Promise<void>;
  t: Translate;
  /** True while a newly chosen language is loading. */
  switching: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

/** Pre-cookie builds stored the choice here; migrated once on first load. */
const LEGACY_STORAGE_KEY = "plantguard-language";

function persist(language: LanguageCode): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie; the Cookie Store API is not available in every supported browser.
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  document.documentElement.lang = language;
}

/**
 * Provides `t()` to Client Components.
 *
 * The server resolves the language (cookie, else Accept-Language) and passes
 * the finished dictionary in, so the first render — on the server and in the
 * browser — is already in the right language.
 */
export function LanguageProvider({
  initialLanguage,
  initialDictionary,
  children,
}: {
  initialLanguage: LanguageCode;
  initialDictionary: Dictionary;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState({
    language: initialLanguage,
    dictionary: initialDictionary,
  });
  const [switching, startTransition] = useTransition();

  const setLanguage = useCallback(
    async (language: LanguageCode) => {
      const dictionary = await loadDictionary(language);
      persist(language);
      setState({ language, dictionary });
      // Server Components rendered text too; re-render them in the new language.
      startTransition(() => router.refresh());
    },
    [router],
  );

  useEffect(() => {
    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        const hasCookie = document.cookie
          .split(";")
          .some((c) => c.trim().startsWith(`${LANGUAGE_COOKIE}=`));
        if (
          !hasCookie &&
          isLanguageCode(legacy) &&
          legacy !== initialLanguage
        ) {
          void setLanguage(legacy);
        }
      }
    } catch {
      // Storage can be blocked; the cookie path still works.
    }
  }, [initialLanguage, setLanguage]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language: state.language,
      setLanguage,
      switching,
      t: (key, ...args) => translate(state.dictionary, key, args),
    }),
    [state, setLanguage, switching],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
