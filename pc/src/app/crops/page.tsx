"use client";

import { useLanguage } from "../lib/i18n/LanguageContext";

export default function CropsPage() {
  const { t } = useLanguage();

  return (
    <main className="shell" style={{ paddingBlock: "32px 80px", maxWidth: "800px" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>{t("crops.title")}</h1>
        <p className="muted" style={{ marginTop: 8 }}>{t("crops.desc")}</p>
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
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <line x1="3" x2="21" y1="9" y2="9"/>
            <line x1="9" x2="9" y1="21" y2="9"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t("crops.emptyTitle")}</h2>
        <p className="muted" style={{ maxWidth: 400 }}>
          {t("crops.emptyDesc")}
        </p>
      </div>
    </main>
  );
}
