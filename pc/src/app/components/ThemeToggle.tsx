"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "plantguard-theme";
const ORDER: Theme[] = ["system", "light", "dark"];

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

const LABELS: Record<Theme, string> = {
  system: "Match system theme",
  light: "Light theme",
  dark: "Dark theme",
};

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export default function ThemeToggle() {
  // Start as `system` on both server and client so the first paint matches the
  // markup the server sent; the real preference is read in an effect below.
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored && ORDER.includes(stored)) setTheme(stored);
    } catch {
      // Storage can throw in private mode or with site data blocked. The
      // default is still correct, so there is nothing to recover from.
    }
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply will not persist; the current session still works.
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={cycle}
      title={LABELS[theme]}
      aria-label={`${LABELS[theme]}. Activate to change.`}
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

/**
 * Runs before first paint to apply the stored theme.
 *
 * Without this the page renders in the default theme and then snaps to the
 * chosen one — a flash of wrong colour on every navigation.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;
