"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { AUTH_PREFIXES, matchesPrefix } from "../lib/routes";
import type { Viewer } from "../lib/viewer";
import MobileNav from "./MobileNav";
import PublicShell from "./PublicShell";
import Sidebar from "./Sidebar";

/**
 * Chooses the chrome for the current page:
 * - auth screens bring their own layout;
 * - a signed-in user gets the sidebar (desktop) and tab bar (mobile);
 * - everyone else gets the public header and footer.
 */
export default function AppShell({
  viewer,
  children,
}: {
  viewer: Viewer | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();

  if (matchesPrefix(pathname, AUTH_PREFIXES)) return <>{children}</>;
  if (!viewer) return <PublicShell>{children}</PublicShell>;

  return (
    <div className="app-layout">
      <a href="#main" className="skip-link">
        {t("nav.skip")}
      </a>
      <Sidebar viewer={viewer} />
      <div className="main-content">
        <div style={{ flex: 1, position: "relative" }}>{children}</div>
      </div>
      <MobileNav />
    </div>
  );
}
