import type { Metadata } from "next";
import { getEnv } from "@/server/env";
import { getServerManifest } from "@/server/model-manifest";
import {
  AlertIcon,
  CameraIcon,
  CheckCircleIcon,
  LeafIcon,
  MailIcon,
  SparkIcon,
} from "../components/icons";
import { getTranslator } from "../lib/i18n/server";
import type { TranslationKey } from "../lib/i18n/types";
import { formatBytes } from "../lib/manifest";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("about.title"), description: t("about.p1Desc") };
}

/** "Title: body" copy, split at the first colon so the title can be bold. */
function titled(text: string): [string, string] {
  const at = text.search(/[:：]/);
  return at === -1
    ? ["", text]
    : [text.slice(0, at), text.slice(at + 1).trim()];
}

const CAPABILITIES: { key: TranslationKey; icon: typeof LeafIcon }[] = [
  { key: "about.li1", icon: CameraIcon },
  { key: "about.li2", icon: LeafIcon },
  { key: "about.li3", icon: CheckCircleIcon },
  { key: "about.li4", icon: SparkIcon },
];

export default async function AboutPage() {
  const [t, manifest] = await Promise.all([
    getTranslator(),
    getServerManifest(),
  ]);
  const supportEmail = getEnv().SUPPORT_EMAIL;

  return (
    <main id="main" className="shell page" style={{ maxWidth: 960 }}>
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("about.eyebrow")}</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            {t("about.title")}
          </h1>
        </div>
      </header>

      <section className="card card-pad about-intro">
        <h2 className="section-title" style={{ fontSize: 22 }}>
          {t("about.p1Title")}
        </h2>
        <p
          className="muted"
          style={{ fontSize: 16, lineHeight: 1.7, marginTop: 10 }}
        >
          {t("about.p1Desc")}
        </p>

        <ul className="capability-list">
          {CAPABILITIES.map(({ key, icon: Icon }) => {
            const [title, body] = titled(t(key));
            return (
              <li key={key}>
                <span className="feature-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div>
                  {title && <h3>{title}</h3>}
                  <p>{body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {manifest && (
        <section
          className="card card-pad"
          style={{ marginTop: 20 }}
          aria-labelledby="model-heading"
        >
          <h2 id="model-heading" className="section-title">
            {t("about.modelTitle")}
          </h2>
          <dl className="fact-grid">
            <div>
              <dt>{t("model.backbone")}</dt>
              <dd className="mono">{manifest.backbone.split(".")[0]}</dd>
            </div>
            <div>
              <dt>{t("model.size")}</dt>
              <dd>{formatBytes(manifest.sizeBytes)}</dd>
            </div>
            {manifest.metrics && (
              <>
                <div>
                  <dt>{t("model.accuracy")}</dt>
                  <dd>
                    {(manifest.metrics.diseaseAccuracy * 100).toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt>{t("about.testImages")}</dt>
                  <dd>{manifest.metrics.numSamples.toLocaleString()}</dd>
                </div>
              </>
            )}
            <div>
              <dt>{t("model.explanation")}</dt>
              <dd>
                {manifest.cam.exact
                  ? t("model.exactCam")
                  : t("model.approxCam")}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section
        className="card card-pad about-limits"
        style={{ marginTop: 20 }}
        aria-labelledby="limits-heading"
      >
        <h2
          id="limits-heading"
          className="section-title"
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <AlertIcon size={20} />
          {t("about.p2Title")}
        </h2>
        <p className="muted" style={{ marginTop: 8 }}>
          {t("about.p2Desc")}
        </p>
        <ul className="advice-list" style={{ marginTop: 12, fontSize: 14.5 }}>
          <li>{t("about.li5")}</li>
          <li>{t("about.li6")}</li>
          <li>{t("about.li7")}</li>
        </ul>
      </section>

      {supportEmail && (
        <section className="privacy-note" style={{ marginTop: 20 }}>
          <MailIcon size={20} />
          <p>
            {t("about.contact")}{" "}
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </p>
        </section>
      )}
    </main>
  );
}
