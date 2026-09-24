"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "../lib/i18n/LanguageContext";
import Brand from "./Brand";
import LanguageSelector from "./LanguageSelector";
import ThemeToggle from "./ThemeToggle";

/** Header and footer for visitors who are not signed in. */
export default function PublicShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const pathname = usePathname();

  const links = [
    { href: "/crops", label: t("nav.crops") },
    { href: "/about", label: t("nav.about") },
  ];

  return (
    <div className="public-layout">
      <a href="#main" className="skip-link">
        {t("nav.skip")}
      </a>

      <header className="public-header">
        <div className="shell public-header-inner">
          <Brand size="sm" />

          <nav aria-label={t("nav.menu")} className="public-nav">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="public-nav-link"
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="public-actions">
            <LanguageSelector variant="compact" />
            <ThemeToggle />
            <Link href="/sign-in" className="btn btn-ghost btn-sm">
              {t("nav.signIn")}
            </Link>
            <Link
              href="/sign-up"
              className="btn btn-primary btn-sm hide-mobile"
            >
              {t("nav.getStarted")}
            </Link>
          </div>
        </div>
      </header>

      <div style={{ flex: 1 }}>{children}</div>

      <footer className="public-footer">
        <div className="shell public-footer-inner">
          <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
            <Brand size="sm" />
            <p className="dim" style={{ fontSize: 13.5 }}>
              {t("footer.tagline")}
            </p>
          </div>
          <nav aria-label={t("footer.links")} className="footer-links">
            <Link href="/crops">{t("nav.crops")}</Link>
            <Link href="/about">{t("nav.about")}</Link>
            <Link href="/privacy">{t("footer.privacy")}</Link>
            <Link href="/terms">{t("footer.terms")}</Link>
            <Link href="/sign-in">{t("nav.signIn")}</Link>
          </nav>
        </div>
        <div
          className="shell dim"
          style={{ fontSize: 12.5, paddingBottom: 24 }}
        >
          © {new Date().getFullYear()} PlantGuard. {t("footer.rights")}
        </div>
      </footer>
    </div>
  );
}
