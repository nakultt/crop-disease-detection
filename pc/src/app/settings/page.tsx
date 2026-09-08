"use client";

import ThemeToggle from "../components/ThemeToggle";
import LanguageSelector from "../components/LanguageSelector";
import { useLanguage } from "../lib/i18n/LanguageContext";

export default function SettingsPage() {
  const { t } = useLanguage();

  return (
    <main className="shell" style={{ paddingBlock: "32px 80px", maxWidth: "800px" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>{t("settings.title")}</h1>
        <p className="muted" style={{ marginTop: 8 }}>{t("settings.desc")}</p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <section>
          <h2 className="label" style={{ marginBottom: 12 }}>{t("settings.appearance")}</h2>
          <div className="card card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>{t("settings.theme")}</h3>
              <p className="muted" style={{ fontSize: 14 }}>{t("settings.themeDesc")}</p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        <section>
          <h2 className="label" style={{ marginBottom: 12 }}>{t("settings.language")}</h2>
          <div className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{t("settings.displayLanguage")}</h3>
                <p className="muted" style={{ fontSize: 14 }}>{t("settings.displayLanguageDesc")}</p>
              </div>
            </div>
            
            <LanguageSelector />
          </div>
        </section>

        <section>
          <h2 className="label" style={{ marginBottom: 12 }}>{t("settings.privacy")}</h2>
          <div className="card card-pad" style={{ background: "var(--surface-2)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              </svg>
              {t("settings.localProcessing")}
            </h3>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
              {t("settings.localProcessingDesc")}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
