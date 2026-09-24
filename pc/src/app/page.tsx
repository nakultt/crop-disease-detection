import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerManifest } from "@/server/model-manifest";
import { getViewerSafe } from "@/server/session";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckCircleIcon,
  GlobeIcon,
  HistoryIcon,
  LeafIcon,
  LockIcon,
  SparkIcon,
} from "./components/icons";
import { getTranslator } from "./lib/i18n/server";
import type { TranslationKey } from "./lib/i18n/types";
import { cropNameLabel } from "./lib/labels";
import { cropOf } from "./lib/manifest";

const FEATURES: {
  icon: typeof LeafIcon;
  title: TranslationKey;
  body: TranslationKey;
}[] = [
  { icon: CameraIcon, title: "landing.f1Title", body: "landing.f1Body" },
  { icon: SparkIcon, title: "landing.f2Title", body: "landing.f2Body" },
  { icon: LeafIcon, title: "landing.f3Title", body: "landing.f3Body" },
  { icon: CheckCircleIcon, title: "landing.f4Title", body: "landing.f4Body" },
  { icon: HistoryIcon, title: "landing.f5Title", body: "landing.f5Body" },
  { icon: GlobeIcon, title: "landing.f6Title", body: "landing.f6Body" },
];

const STEPS: [TranslationKey, TranslationKey][] = [
  ["home.step1", "home.step1Desc"],
  ["home.step2", "home.step2Desc"],
  ["home.step3", "home.step3Desc"],
  ["home.step4", "home.step4Desc"],
];

const FAQ: [TranslationKey, TranslationKey][] = [
  ["landing.q1", "landing.a1"],
  ["landing.q2", "landing.a2"],
  ["landing.q3", "landing.a3"],
  ["landing.q4", "landing.a4"],
  ["landing.q5", "landing.a5"],
  ["landing.q6", "landing.a6"],
];

export default async function LandingPage() {
  if (await getViewerSafe()) redirect("/dashboard");

  const [t, manifest] = await Promise.all([
    getTranslator(),
    getServerManifest(),
  ]);

  const accuracy = manifest?.metrics
    ? `${(manifest.metrics.diseaseAccuracy * 100).toFixed(0)}%`
    : "97%";
  const conditions = manifest?.classes.disease.length ?? 38;
  const crops = [...new Set((manifest?.classes.disease ?? []).map(cropOf))];

  return (
    <main id="main">
      {/* Hero */}
      <section className="landing-hero">
        <div className="shell landing-hero-inner">
          <div className="landing-hero-copy">
            <span className="chip">
              <span
                className="dot"
                style={{ color: "var(--accent)" }}
                aria-hidden="true"
              />
              {t("landing.chip", conditions, crops.length || 14)}
            </span>
            <h1 className="landing-title">{t("landing.title")}</h1>
            <p className="landing-lead">{t("landing.lead")}</p>
            <div className="landing-ctas">
              <Link href="/sign-up" className="btn btn-primary btn-lg">
                {t("landing.ctaPrimary")}
                <ArrowRightIcon size={18} />
              </Link>
              <Link href="/sign-in" className="btn btn-secondary btn-lg">
                {t("nav.signIn")}
              </Link>
            </div>
            <ul className="landing-trust">
              <li>
                <CheckCircleIcon size={16} /> {t("landing.trust1")}
              </li>
              <li>
                <CheckCircleIcon size={16} /> {t("landing.trust2")}
              </li>
              <li>
                <CheckCircleIcon size={16} /> {t("landing.trust3")}
              </li>
            </ul>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-photo">
              <Image
                src="/login-bg-indian.png"
                alt={t("landing.photoAlt")}
                fill
                priority
                sizes="(min-width: 960px) 44vw, 92vw"
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className="mock-result" aria-hidden="true">
              <div className="mock-heat" />
              <div style={{ minWidth: 0 }}>
                <div className="mock-eyebrow">{cropNameLabel("Tomato", t)}</div>
                <div className="mock-title">{t("cond.earlyBlight")}</div>
                <div className="mock-meta">
                  <span className="mock-pct">99.7%</span>
                  <span className="badge">
                    <span
                      className="dot"
                      style={{ color: "var(--moderate)" }}
                    />
                    {t("sev.moderate")}
                  </span>
                </div>
              </div>
            </div>
            <div className="mock-tip" aria-hidden="true">
              <SparkIcon size={16} />
              {t("landing.mockTip")}
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="shell" aria-label={t("landing.statsLabel")}>
        <div className="stats-band">
          <div>
            <strong>{accuracy}</strong>
            <span>{t("landing.statAccuracy")}</span>
          </div>
          <div>
            <strong>{conditions}</strong>
            <span>{t("landing.statConditions")}</span>
          </div>
          <div>
            <strong>{"< 1 s"}</strong>
            <span>{t("landing.statSpeed")}</span>
          </div>
          <div>
            <strong>8</strong>
            <span>{t("landing.statLanguages")}</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        className="shell landing-section"
        aria-labelledby="features-heading"
      >
        <div className="section-heading">
          <span className="eyebrow">{t("landing.featuresEyebrow")}</span>
          <h2 id="features-heading">{t("landing.featuresTitle")}</h2>
          <p>{t("landing.featuresLead")}</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <h3>{t(title)}</h3>
              <p>{t(body)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="landing-band" aria-labelledby="how-heading">
        <div className="shell landing-section">
          <div className="section-heading">
            <span className="eyebrow">{t("landing.howEyebrow")}</span>
            <h2 id="how-heading">{t("home.howItWorks")}</h2>
          </div>
          <ol className="steps">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="step">
                <span className="step-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{t(title)}</h3>
                <p>{t(body)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Crops */}
      <section
        className="shell landing-section"
        aria-labelledby="crops-heading"
      >
        <div className="section-heading">
          <span className="eyebrow">{t("landing.cropsEyebrow")}</span>
          <h2 id="crops-heading">{t("landing.cropsTitle")}</h2>
          <p>{t("landing.cropsLead")}</p>
        </div>
        <ul className="crop-chips">
          {crops.map((crop) => (
            <li key={crop}>
              <LeafIcon size={15} />
              {cropNameLabel(crop, t)}
            </li>
          ))}
        </ul>
        <p style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/crops" className="link-arrow">
            {t("landing.cropsLink")}
            <ArrowRightIcon size={16} />
          </Link>
        </p>
      </section>

      {/* Privacy */}
      <section
        className="shell landing-section"
        aria-labelledby="privacy-heading"
      >
        <div className="privacy-panel">
          <span className="feature-icon" aria-hidden="true">
            <LockIcon size={22} />
          </span>
          <div>
            <h2 id="privacy-heading">{t("landing.privacyTitle")}</h2>
            <p>{t("landing.privacyBody")}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        className="shell landing-section"
        aria-labelledby="faq-heading"
        style={{ maxWidth: 860 }}
      >
        <div className="section-heading">
          <span className="eyebrow">{t("landing.faqEyebrow")}</span>
          <h2 id="faq-heading">{t("landing.faqTitle")}</h2>
        </div>
        <div className="faq">
          {FAQ.map(([question, answer]) => (
            <details key={question}>
              <summary>{t(question)}</summary>
              <p>{t(answer)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="shell landing-section">
        <div className="cta-band">
          <div>
            <h2>{t("landing.ctaTitle")}</h2>
            <p>{t("landing.ctaBody")}</p>
          </div>
          <Link href="/sign-up" className="btn btn-accent btn-lg">
            {t("landing.ctaPrimary")}
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
