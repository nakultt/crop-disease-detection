"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { TranslationKey } from "../lib/i18n/types";
import {
  readStoredTheme,
  setTheme,
  THEME_EVENT,
  THEMES,
  type Theme,
} from "../lib/theme";

const ICONS: Record<Theme, React.ReactNode> = {
  system: (
    <>
      <rect x="2.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M6 15h6" />
    </>
  ),
  light: (
    <>
      <circle cx="9" cy="9" r="3.4" />
      <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4" />
    </>
  ),
  dark: <path d="M15 10.4A6.3 6.3 0 1 1 7.6 3a5 5 0 0 0 7.4 7.4Z" />,
};

export const THEME_LABELS: Record<Theme, TranslationKey> = {
  system: "theme.system",
  light: "theme.light",
  dark: "theme.dark",
};

/** Follows the stored theme and changes made anywhere else on the page. */
export function useTheme(): [Theme, boolean] {
  // Start as `system` on both server and client so the first render matches
  // the server markup; the stored preference is read after mount.
  const [theme, setLocal] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLocal(readStoredTheme());
    const onChange = (event: Event) =>
      setLocal((event as CustomEvent<Theme>).detail);
    window.addEventListener(THEME_EVENT, onChange);
    return () => window.removeEventListener(THEME_EVENT, onChange);
  }, []);

  return [theme, mounted];
}

/** One-button theme switch: system → light → dark. */
export default function ThemeToggle() {
  const { t } = useLanguage();
  const [theme, mounted] = useTheme();
  const label = t(THEME_LABELS[theme]);

  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={() =>
        setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])
      }
      title={label}
      aria-label={t("theme.toggle", label)}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ opacity: mounted ? 1 : 0, transition: "opacity 120ms" }}
      >
        {ICONS[theme]}
      </svg>
    </button>
  );
}

/** Segmented light / dark / system control for the settings page. */
export function ThemeSelect() {
  const { t } = useLanguage();
  const [theme] = useTheme();

  return (
    <fieldset className="segmented" style={{ border: 0, margin: 0 }}>
      <legend className="sr-only">{t("settings.theme")}</legend>
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => setTheme(option)}
        >
          {t(THEME_LABELS[option])}
        </button>
      ))}
    </fieldset>
  );
}
