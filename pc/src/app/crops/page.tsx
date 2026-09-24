import type { Metadata } from "next";
import Link from "next/link";
import { getServerManifest } from "@/server/model-manifest";
import { getViewerSafe } from "@/server/session";
import { ArrowRightIcon, CheckCircleIcon, LeafIcon } from "../components/icons";
import { getTranslator } from "../lib/i18n/server";
import { conditionLabel, cropNameLabel } from "../lib/labels";
import { cropOf, isHealthy } from "../lib/manifest";
import { recommendationKeys } from "../lib/recommendations";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("crops.title"), description: t("crops.desc") };
}

/** Every crop and condition the deployed model knows, with what to do about each. */
export default async function CropsPage() {
  const [t, manifest, viewer] = await Promise.all([
    getTranslator(),
    getServerManifest(),
    getViewerSafe(),
  ]);

  const classes = manifest?.classes.disease ?? [];
  const byCrop = new Map<string, string[]>();
  for (const className of classes) {
    const crop = cropOf(className);
    byCrop.set(crop, [...(byCrop.get(crop) ?? []), className]);
  }
  const diseases = classes.filter((c) => !isHealthy(c)).length;

  return (
    <main id="main" className="shell page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("crops.title")}</h1>
          <p className="page-desc">{t("crops.desc")}</p>
        </div>
        <span className="chip">
          <span
            className="dot"
            style={{ color: "var(--accent)" }}
            aria-hidden="true"
          />
          {t("crops.summary", diseases, byCrop.size)}
        </span>
      </header>

      <div className="crop-grid">
        {[...byCrop.entries()].map(([crop, conditions]) => (
          <section
            key={crop}
            className="card crop-card"
            aria-labelledby={`crop-${crop}`}
          >
            <div className="crop-card-head">
              <span className="feature-icon" aria-hidden="true">
                <LeafIcon size={20} />
              </span>
              <h2 id={`crop-${crop}`}>{cropNameLabel(crop, t)}</h2>
            </div>
            <ul className="condition-list">
              {conditions.map((className) =>
                isHealthy(className) ? (
                  <li key={className} className="condition-healthy">
                    <CheckCircleIcon size={16} />
                    {t("crops.healthyRecognised")}
                  </li>
                ) : (
                  <li key={className}>
                    <details>
                      <summary>{conditionLabel(className, t)}</summary>
                      <ul className="advice-list">
                        {recommendationKeys(className, "").map(({ key }) => (
                          <li key={key}>{t(key)}</li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>

      <section className="cta-band" style={{ marginTop: 40 }}>
        <div>
          <h2>{t("crops.ctaTitle")}</h2>
          <p>{t("crops.ctaBody")}</p>
        </div>
        <Link
          href={viewer ? "/scan" : "/sign-up"}
          className="btn btn-accent btn-lg"
        >
          {viewer ? t("dash.newScan") : t("landing.ctaPrimary")}
          <ArrowRightIcon size={18} />
        </Link>
      </section>

      <p className="dim" style={{ marginTop: 20, fontSize: 12.5 }}>
        {t("rec.disclaimer")}
      </p>
    </main>
  );
}
