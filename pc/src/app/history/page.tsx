"use client";

import { useLanguage } from "../lib/i18n/LanguageContext";

export default function HistoryPage() {
  const { t } = useLanguage();

  return (
    <main className="shell" style={{ paddingBlock: "32px 80px", maxWidth: "800px" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>{t("history.title")}</h1>
        <p className="muted" style={{ marginTop: 8 }}>{t("history.desc")}</p>
      </header>

      <div 
        className="card card-pad" 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center",
          padding: "64px 24px",
          textAlign: "center",
          background: "var(--surface-2)",
          borderStyle: "dashed"
        }}
      >
        <div style={{ 
          width: 64, 
          height: 64, 
          borderRadius: "50%", 
          background: "var(--surface)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          marginBottom: 16,
          color: "var(--text-3)"
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t("history.emptyTitle")}</h2>
        <p className="muted" style={{ maxWidth: 400 }}>
          {t("history.emptyDesc")}
        </p>
      </div>
    </main>
  );
}
