"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "../lib/i18n/LanguageContext";
import {
  CropsIcon,
  HistoryIcon,
  HomeIcon,
  LeafIcon,
  SettingsIcon,
} from "./icons";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom tab bar for phones, with the scan action raised in the middle. */
export default function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const left = [
    { href: "/dashboard", label: t("nav.home"), icon: HomeIcon },
    { href: "/history", label: t("nav.history"), icon: HistoryIcon },
  ];
  const right = [
    { href: "/crops", label: t("nav.crops"), icon: CropsIcon },
    { href: "/settings", label: t("nav.settings"), icon: SettingsIcon },
  ];

  const tab = (link: (typeof left)[number]) => {
    const active = isActive(pathname, link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        className="mobile-tab"
        aria-current={active ? "page" : undefined}
      >
        <link.icon size={24} active={active} />
        <span className="mobile-tab-label">{link.label}</span>
      </Link>
    );
  };

  return (
    <nav aria-label={t("nav.menu")} className="mobile-nav">
      {left.map(tab)}
      <div className="mobile-fab-slot">
        <Link
          href="/scan"
          className="mobile-fab"
          aria-label={t("nav.scan")}
          aria-current={isActive(pathname, "/scan") ? "page" : undefined}
        >
          <LeafIcon size={28} />
        </Link>
      </div>
      {right.map(tab)}
    </nav>
  );
}
