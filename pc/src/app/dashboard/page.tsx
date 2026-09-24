import type { Metadata } from "next";
import Link from "next/link";
import { getServerManifest } from "@/server/model-manifest";
import { getUserStats, recentScans } from "@/server/scans";
import { requireSession, toViewer } from "@/server/session";
import Alert from "../components/Alert";
import BarList from "../components/charts/BarList";
import TimeColumnChart from "../components/charts/TimeColumnChart";
import {
  AlertIcon,
  ArrowRightIcon,
  CameraIcon,
  CheckCircleIcon,
  HistoryIcon,
  LeafIcon,
  SparkIcon,
} from "../components/icons";
import ScanCard from "../components/ScanCard";
import { shortDate } from "../lib/dates";
import { getLanguage, getTranslator } from "../lib/i18n/server";
import { classLabel, cropNameLabel } from "../lib/labels";
import { first, type SearchParams } from "../lib/search-params";
import { SEVERITY_ORDER, severityColor, severityLabel } from "../lib/severity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("dash.title") };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const viewer = toViewer(await requireSession("/dashboard"));
  const params = await searchParams;
  const t = await getTranslator();
  const language = await getLanguage();

  const [stats, recent, manifest] = await Promise.all([
    getUserStats(viewer.id),
    recentScans(viewer.id, 5),
    getServerManifest(),
  ]);

  const firstName =
    viewer.name.trim().split(/\s+/)[0] || viewer.email.split("@")[0];
  const isNew = stats.total === 0;
  const levels = manifest?.classes.severity ?? SEVERITY_ORDER;
  const diseasedShare =
    stats.total > 0 ? Math.round((stats.diseased / stats.total) * 100) : 0;
  const healthyShare = stats.total > 0 ? 100 - diseasedShare : 0;

  return (
    <main id="main" className="shell page">
      {first(params.welcome) === "1" && (
        <div style={{ marginBottom: 20 }}>
          <Alert tone="success" title={t("dash.welcomeTitle")}>
            {t("dash.welcomeDesc")}
          </Alert>
        </div>
      )}

      <section className="hero-card">
        <div className="hero-card-pattern" aria-hidden="true" />
        <div
          style={{
            position: "relative",
            display: "grid",
            gap: 8,
            maxWidth: 560,
          }}
        >
          <span className="hero-eyebrow">{t("dash.eyebrow")}</span>
          <h1 className="hero-card-title">
            {isNew
              ? t("dash.welcomeNew", firstName)
              : t("dash.welcome", firstName)}
          </h1>
          <p className="hero-card-desc">
            {isNew ? t("dash.emptyDesc") : t("dash.subtitle")}
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 12,
            }}
          >
            <Link href="/scan" className="btn btn-accent">
              <CameraIcon size={18} />
              {t("dash.newScan")}
            </Link>
            {!isNew && (
              <Link href="/history" className="btn btn-on-dark">
                {t("dash.viewHistory")}
                <ArrowRightIcon size={16} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {isNew ? (
        <section style={{ marginTop: 28 }} aria-labelledby="tips-heading">
          <h2
            id="tips-heading"
            className="section-title"
            style={{ marginBottom: 16 }}
          >
            {t("dash.tipsTitle")}
          </h2>
          <div className="grid-auto">
            {(
              [
                ["dash.tip1Title", "dash.tip1"],
                ["dash.tip2Title", "dash.tip2"],
                ["dash.tip3Title", "dash.tip3"],
              ] as const
            ).map(([title, body], i) => (
              <div key={title} className="card card-pad tip-card">
                <span className="step-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 style={{ fontSize: 16, fontWeight: 650 }}>{t(title)}</h3>
                <p className="muted" style={{ fontSize: 14 }}>
                  {t(body)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="kpi-row" aria-label={t("dash.summary")}>
            <StatTile
              icon={<HistoryIcon />}
              tone="primary"
              label={t("dash.statTotal")}
              value={stats.total.toLocaleString()}
              hint={t("dash.last30", stats.last30Days)}
            />
            <StatTile
              icon={<AlertIcon />}
              tone="warning"
              label={t("dash.statDiseased")}
              value={stats.diseased.toLocaleString()}
              hint={t("dash.ofTotal", diseasedShare)}
            />
            <StatTile
              icon={<CheckCircleIcon />}
              tone="good"
              label={t("dash.statHealthy")}
              value={stats.healthy.toLocaleString()}
              hint={t("dash.ofTotal", healthyShare)}
            />
            <StatTile
              icon={<SparkIcon />}
              tone="accent"
              label={t("dash.topProblem")}
              value={
                stats.topConditions[0]
                  ? classLabel(stats.topConditions[0].className, t)
                  : "—"
              }
              hint={
                stats.topConditions[0]
                  ? t("dash.scansCount", stats.topConditions[0].count)
                  : t("dash.noDisease")
              }
              compact
            />
          </section>

          <div className="dash-grid">
            <section
              className="card card-pad dash-wide"
              aria-labelledby="weekly-heading"
            >
              <div className="card-head">
                <h2 id="weekly-heading" className="section-title">
                  {t("dash.weekly")}
                </h2>
                <span className="dim" style={{ fontSize: 13 }}>
                  {t("dash.weeklyDesc")}
                </span>
              </div>
              <TimeColumnChart
                unit="week"
                valueHeader={t("dash.statTotal")}
                points={stats.weekly.map((w) => ({
                  start: w.weekStart,
                  count: w.count,
                  label: shortDate(w.weekStart, language),
                }))}
              />
            </section>

            <section
              className="card card-pad"
              aria-labelledby="severity-heading"
            >
              <div className="card-head">
                <h2 id="severity-heading" className="section-title">
                  {t("dash.severityMix")}
                </h2>
              </div>
              {stats.diseased === 0 ? (
                <p className="muted" style={{ fontSize: 14 }}>
                  {t("dash.noDisease")}
                </p>
              ) : (
                <BarList
                  label={t("dash.severityMix")}
                  items={levels.map((level) => ({
                    key: level,
                    label: severityLabel(level, t),
                    value:
                      stats.bySeverity.find((s) => s.level === level)?.count ??
                      0,
                    color: severityColor(level),
                  }))}
                />
              )}
            </section>

            <section className="card card-pad" aria-labelledby="crops-heading">
              <div className="card-head">
                <h2 id="crops-heading" className="section-title">
                  {t("dash.crops")}
                </h2>
              </div>
              <BarList
                label={t("dash.crops")}
                items={stats.byCrop.map((c) => ({
                  key: c.crop,
                  label: cropNameLabel(c.crop, t),
                  value: c.count,
                }))}
              />
            </section>

            <section
              className="card card-pad dash-wide"
              aria-labelledby="conditions-heading"
            >
              <div className="card-head">
                <h2 id="conditions-heading" className="section-title">
                  {t("dash.topConditions")}
                </h2>
              </div>
              {stats.topConditions.length === 0 ? (
                <p className="muted" style={{ fontSize: 14 }}>
                  {t("dash.noDisease")}
                </p>
              ) : (
                <BarList
                  label={t("dash.topConditions")}
                  items={stats.topConditions.map((c) => ({
                    key: c.className,
                    label: classLabel(c.className, t),
                    value: c.count,
                    color: "var(--accent)",
                  }))}
                />
              )}
            </section>
          </div>

          <section style={{ marginTop: 32 }} aria-labelledby="recent-heading">
            <div className="card-head" style={{ marginBottom: 16 }}>
              <h2 id="recent-heading" className="section-title">
                {t("dash.recent")}
              </h2>
              <Link href="/history" className="link-arrow">
                {t("dash.viewAll")}
                <ArrowRightIcon size={16} />
              </Link>
            </div>
            <div className="scan-grid">
              {recent.map((scan) => (
                <ScanCard key={scan.id} scan={scan} />
              ))}
            </div>
          </section>
        </>
      )}

      <p
        className="dim"
        style={{
          marginTop: 32,
          fontSize: 12.5,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <LeafIcon size={14} />
        {t("dash.disclaimer")}
      </p>
    </main>
  );
}

function StatTile({
  icon,
  tone,
  label,
  value,
  hint,
  compact,
}: {
  icon: React.ReactNode;
  tone: "primary" | "warning" | "good" | "accent";
  label: string;
  value: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <div className="card stat" data-tone={tone}>
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="stat-label">{label}</span>
      <span
        className={compact ? "stat-value stat-value-compact" : "stat-value"}
      >
        {value}
      </span>
      <span className="stat-hint">{hint}</span>
    </div>
  );
}
