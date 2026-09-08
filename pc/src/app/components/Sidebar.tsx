"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { useLanguage } from "../lib/i18n/LanguageContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const links = [
    { href: "/", label: t("nav.home"), icon: HomeIcon },
    { href: "/scan", label: t("nav.scan"), icon: ScanIcon, primary: true },
    { href: "/history", label: t("nav.history"), icon: HistoryIcon },
    { href: "/crops", label: t("nav.crops"), icon: CropsIcon },
    { href: "/about", label: t("nav.about"), icon: InfoIcon },
  ];

  return (
    <aside
      className="desktop-sidebar hidden md:flex"
      style={{
        width: "var(--sidebar-w)",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        flexDirection: "column",
        zIndex: 50,
      }}
    >
      <div style={{ padding: "32px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--radius-sm)",
            background: "var(--primary)",
            color: "var(--primary-on)",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <ScanIcon active={true} />
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em", color: "var(--text)" }}>
          PlantGuard
        </span>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
        {links.map((link) => {
          const active = pathname === link.href || (pathname === "/" && link.href === "/");
          const isActive = pathname === link.href;

          if (link.primary) {
            return (
              <div key={link.href} style={{ padding: "8px 0 16px" }}>
                <Link
                  href={link.href}
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    height: 48,
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <link.icon active={true} />
                  {link.label}
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                background: isActive ? "var(--surface-2)" : "transparent",
                color: isActive ? "var(--primary)" : "var(--text-2)",
                fontWeight: isActive ? 600 : 500,
                textDecoration: "none",
                transition: "background var(--ease-out), color var(--ease-out)",
              }}
            >
              <link.icon active={isActive} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "24px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
        <Link
          href="/settings"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            background: pathname === "/settings" ? "var(--surface-2)" : "transparent",
            color: pathname === "/settings" ? "var(--primary)" : "var(--text-2)",
            fontWeight: pathname === "/settings" ? 600 : 500,
            textDecoration: "none",
          }}
        >
          <SettingsIcon active={pathname === "/settings"} />
          {t("nav.settings")}
        </Link>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-2)" }}>{t("settings.theme")}</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function ScanIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16c0-6 4-10 12-11 0 8-4 12-9 12a5 5 0 0 1-3-1Z" />
      <path d="M4 16c2-4 5-6.5 9-8" />
    </svg>
  );
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function CropsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <line x1="3" x2="21" y1="9" y2="9"/>
      <line x1="9" x2="9" y1="21" y2="9"/>
    </svg>
  );
}

function InfoIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4"/>
      <path d="M12 8h.01"/>
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
