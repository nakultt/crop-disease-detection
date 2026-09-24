/**
 * Light / dark / system theme, stored per device.
 *
 * Kept outside any client component so the root layout (a Server Component)
 * can inline the boot script as a plain string.
 */

export type Theme = "light" | "dark" | "system";

export const THEMES: Theme[] = ["system", "light", "dark"];

export const THEME_STORAGE_KEY = "plantguard-theme";

/** Fired on `window` whenever the theme changes, so every control stays in sync. */
export const THEME_EVENT = "plantguard:theme";

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can throw in private mode; the default is still correct.
  }
  return "system";
}

export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The preference will not persist, but this session still switches.
  }
  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
}

/**
 * Runs before first paint to apply the stored theme. Without it the page
 * renders in the default theme and then snaps — a flash on every load.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;
