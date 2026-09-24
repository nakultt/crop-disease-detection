"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { Viewer } from "../lib/viewer";
import Brand from "./Brand";
import {
  CropsIcon,
  HistoryIcon,
  HomeIcon,
  InfoIcon,
  LeafIcon,
  SettingsIcon,
  ShieldIcon,
} from "./icons";
import SignOutButton from "./SignOutButton";
import ThemeToggle from "./ThemeToggle";
import UserAvatar from "./UserAvatar";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const links = [
    { href: "/dashboard", label: t("nav.home"), icon: HomeIcon },
    { href: "/history", label: t("nav.history"), icon: HistoryIcon },
    { href: "/crops", label: t("nav.crops"), icon: CropsIcon },
    { href: "/about", label: t("nav.about"), icon: InfoIcon },
    ...(viewer.isAdmin
      ? [{ href: "/admin", label: t("nav.admin"), icon: ShieldIcon }]
      : []),
  ];

  const scanActive = isActive(pathname, "/scan");
  const settingsActive = isActive(pathname, "/settings");

  return (
    <aside className="desktop-sidebar">
      <div style={{ padding: "28px 24px 24px" }}>
        <Brand href="/dashboard" />
      </div>

      <nav aria-label={t("nav.menu")} className="sidebar-nav">
        <div style={{ padding: "4px 0 16px" }}>
          <Link
            href="/scan"
            className="btn btn-primary"
            aria-current={scanActive ? "page" : undefined}
            style={{
              width: "100%",
              justifyContent: "flex-start",
              height: 48,
              borderRadius: "var(--radius-md)",
            }}
          >
            <LeafIcon active />
            {t("nav.scan")}
          </Link>
        </div>

        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              aria-current={active ? "page" : undefined}
            >
              <link.icon active={active} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <Link
          href="/settings"
          className="nav-link"
          aria-current={settingsActive ? "page" : undefined}
        >
          <SettingsIcon active={settingsActive} />
          {t("nav.settings")}
        </Link>
        <div className="sidebar-row">
          <span
            style={{ fontSize: 14, fontWeight: 500, color: "var(--text-2)" }}
          >
            {t("settings.theme")}
          </span>
          <ThemeToggle />
        </div>

        <div className="sidebar-user">
          <UserAvatar name={viewer.name} email={viewer.email} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>
              {viewer.name || viewer.email}
            </div>
            <div className="truncate dim" style={{ fontSize: 12.5 }}>
              {viewer.email}
            </div>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
