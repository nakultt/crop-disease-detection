"use client";

import Link from "next/link";
import { useLanguage } from "./lib/i18n/LanguageContext";

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <main style={{ padding: "32px 24px", maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* Hero Section */}
      <section style={{ textAlign: "center", paddingTop: "24px" }}>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1.1 }}>
          {t("home.title")}
        </h1>
        <p className="muted" style={{ fontSize: 18, marginTop: 16, maxWidth: "50ch", marginInline: "auto", lineHeight: 1.6 }}>
          {t("home.desc")}
        </p>
      </section>

      {/* Primary Scan Action */}
      <section style={{ margin: "24px 0" }}>
        <div className="card card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", background: "var(--primary-soft)", border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)" }}>
          <div style={{ marginBottom: 16, color: "var(--primary)" }}>
             <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 16c0-6 4-10 12-11 0 8-4 12-9 12a5 5 0 0 1-3-1Z" />
              <path d="M4 16c2-4 5-6.5 9-8" />
            </svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            {t("home.scanTitle")}
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-2)", marginBottom: 24, maxWidth: "40ch" }}>
            {t("home.scanDesc")}
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/scan" className="btn btn-primary" style={{ padding: "0 32px", height: 56, fontSize: 16, fontWeight: 600 }}>
              {t("home.startScanning")}
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>{t("home.howItWorks")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <StepCard number="01" title={t("home.step1")} desc={t("home.step1Desc")} />
          <StepCard number="02" title={t("home.step2")} desc={t("home.step2Desc")} />
          <StepCard number="03" title={t("home.step3")} desc={t("home.step3Desc")} />
          <StepCard number="04" title={t("home.step4")} desc={t("home.step4Desc")} />
        </div>
      </section>

      {/* Privacy Feature */}
      <section style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 20, display: "flex", gap: 16, alignItems: "flex-start", background: "var(--surface-2)" }}>
          <div style={{ color: "var(--accent)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t("home.privacyTitle")}</h3>
            <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5 }}>
              {t("home.privacyDesc")}
            </p>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 32, paddingBottom: 32, textAlign: "center" }}>
        <p className="dim" style={{ fontSize: 13 }}>PlantGuard v1.0 &middot; Professional Agriculture AI Platform</p>
      </footer>
    </main>
  );
}

function StepCard({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", background: "var(--primary-soft)", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
        {number}
      </span>
      <h3 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "var(--text-2)" }}>{desc}</p>
    </div>
  );
}
