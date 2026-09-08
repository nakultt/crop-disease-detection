"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { type LanguageCode, translations } from "./translations";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("plantguard-language") as LanguageCode | null;
    if (saved && translations[saved]) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem("plantguard-language", lang);
  };

  const t = (key: string, ...args: (string | number)[]) => {
    const dict = translations[language] || translations["en"];
    let text = dict[key] || translations["en"][key] || key;

    if (args.length > 0) {
      args.forEach((arg, index) => {
        text = text.replace(`{${index}}`, String(arg));
      });
    }

    return text;
  };

  // Prevent hydration mismatch by rendering a stable layout first
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ language: "en", setLanguage, t: () => "" }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
