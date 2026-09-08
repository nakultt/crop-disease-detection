"use client";

import { useLanguage } from "../lib/i18n/LanguageContext";

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <main className="shell" style={{ paddingBlock: "32px 80px", maxWidth: "800px" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>{t("about.title")}</h1>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <section className="card card-pad" style={{ background: "var(--surface)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "var(--primary)" }}>
            {t("about.p1Title")}
          </h2>
          <p style={{ lineHeight: 1.6, marginBottom: 16, color: "var(--text-2)" }}>
            {t("about.p1Desc")}
          </p>
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
            <li><strong>{t("about.li1").split(":")[0]}:</strong> {t("about.li1").split(":")[1]}</li>
            <li><strong>{t("about.li2").split(":")[0]}:</strong> {t("about.li2").split(":")[1]}</li>
            <li><strong>{t("about.li3").split(":")[0]}:</strong> {t("about.li3").split(":")[1]}</li>
            <li><strong>{t("about.li4").split(":")[0]}:</strong> {t("about.li4").split(":")[1]}</li>
          </ul>
        </section>

        <section className="card card-pad" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--error, #e53e3e)" }}>
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" x2="12" y1="9" y2="13"/>
              <line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
            {t("about.p2Title")}
          </h2>
          <p style={{ lineHeight: 1.5, marginBottom: 16, color: "var(--text-2)" }}>
            {t("about.p2Desc")}
          </p>
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, color: "var(--text-3)", fontSize: 14 }}>
            <li>{t("about.li5")}</li>
            <li>{t("about.li6")}</li>
            <li>{t("about.li7")}</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
