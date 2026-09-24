import type { Metadata } from "next";
import Link from "next/link";
import { adminOverview, listUsersForAdmin } from "@/server/admin";
import { requireAdmin } from "@/server/session";
import BarList from "../components/charts/BarList";
import TimeColumnChart from "../components/charts/TimeColumnChart";
import {
  HistoryIcon,
  ImageIcon,
  SearchIcon,
  UsersIcon,
} from "../components/icons";
import { shortDate } from "../lib/dates";
import { getLanguage, getTranslator } from "../lib/i18n/server";
import { classLabel } from "../lib/labels";
import { first, type SearchParams } from "../lib/search-params";
import AdminUsers from "./AdminUsers";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAdmin();
  const t = await getTranslator();
  const language = await getLanguage();
  const withLabels = (points: { start: string; count: number }[]) =>
    points.map((p) => ({ ...p, label: shortDate(p.start, language) }));
  const params = await searchParams;
  const q = first(params.q) ?? "";
  const page = Number(first(params.page)) || 1;

  const [overview, users] = await Promise.all([
    adminOverview(),
    listUsersForAdmin({ q, page }),
  ]);
  const verifiedShare = overview.users.total
    ? Math.round((overview.users.verified / overview.users.total) * 100)
    : 0;

  return (
    <main id="main" className="shell page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("admin.eyebrow")}</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            {t("admin.title")}
          </h1>
          <p className="page-desc">{t("admin.desc")}</p>
        </div>
      </header>

      <section
        className="kpi-row"
        style={{ marginTop: 0 }}
        aria-label={t("dash.summary")}
      >
        <div className="card stat" data-tone="primary">
          <span className="stat-icon" aria-hidden="true">
            <UsersIcon />
          </span>
          <span className="stat-label">{t("admin.users")}</span>
          <span className="stat-value">
            {overview.users.total.toLocaleString()}
          </span>
          <span className="stat-hint">
            {t("admin.newThisWeek", overview.users.newLast7Days)}
          </span>
        </div>
        <div className="card stat" data-tone="good">
          <span className="stat-icon" aria-hidden="true">
            <UsersIcon />
          </span>
          <span className="stat-label">{t("admin.verified")}</span>
          <span className="stat-value">{verifiedShare}%</span>
          <span className="stat-hint">
            {t(
              "admin.adminsBanned",
              overview.users.admins,
              overview.users.banned,
            )}
          </span>
        </div>
        <div className="card stat" data-tone="accent">
          <span className="stat-icon" aria-hidden="true">
            <HistoryIcon />
          </span>
          <span className="stat-label">{t("admin.scans")}</span>
          <span className="stat-value">
            {overview.scans.total.toLocaleString()}
          </span>
          <span className="stat-hint">
            {t("admin.scansThisWeek", overview.scans.last7Days)}
          </span>
        </div>
        <div className="card stat" data-tone="warning">
          <span className="stat-icon" aria-hidden="true">
            <ImageIcon />
          </span>
          <span className="stat-label">{t("admin.photos")}</span>
          <span className="stat-value">
            {overview.scans.withPhotos.toLocaleString()}
          </span>
          <span className="stat-hint">
            {t("admin.diseasedScans", overview.scans.diseased)}
          </span>
        </div>
      </section>

      <div className="dash-grid">
        <section className="card card-pad" aria-labelledby="signups-heading">
          <div className="card-head">
            <h2 id="signups-heading" className="section-title">
              {t("admin.signups")}
            </h2>
            <span className="dim" style={{ fontSize: 13 }}>
              {t("admin.last14")}
            </span>
          </div>
          <TimeColumnChart
            unit="day"
            valueHeader={t("admin.signups")}
            points={withLabels(overview.signupsDaily)}
          />
        </section>
        <section className="card card-pad" aria-labelledby="scans-heading">
          <div className="card-head">
            <h2 id="scans-heading" className="section-title">
              {t("admin.scansDaily")}
            </h2>
            <span className="dim" style={{ fontSize: 13 }}>
              {t("admin.last14")}
            </span>
          </div>
          <TimeColumnChart
            unit="day"
            valueHeader={t("admin.scans")}
            points={withLabels(overview.scansDaily)}
          />
        </section>
        <section className="card card-pad" aria-labelledby="top-heading">
          <div className="card-head">
            <h2 id="top-heading" className="section-title">
              {t("dash.topConditions")}
            </h2>
          </div>
          {overview.topConditions.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              {t("dash.noDisease")}
            </p>
          ) : (
            <BarList
              label={t("dash.topConditions")}
              items={overview.topConditions.map((c) => ({
                key: c.className,
                label: classLabel(c.className, t),
                value: c.count,
                color: "var(--accent)",
              }))}
            />
          )}
        </section>
      </div>

      <section style={{ marginTop: 32 }} aria-labelledby="users-heading">
        <div className="card-head" style={{ alignItems: "center" }}>
          <h2 id="users-heading" className="section-title">
            {t("admin.userList")}
          </h2>
          <search style={{ flex: "0 1 320px" }}>
            <form method="get" className="filters-search">
              <SearchIcon size={18} />
              <input
                type="search"
                name="q"
                className="input"
                defaultValue={q}
                placeholder={t("admin.searchUsers")}
                aria-label={t("admin.searchUsers")}
              />
            </form>
          </search>
        </div>

        <AdminUsers users={users.users} currentUserId={session.user.id} />

        {users.pageCount > 1 && (
          <nav className="pagination" aria-label={t("history.pagination")}>
            {users.page > 1 && (
              <Link
                className="btn btn-secondary btn-sm"
                href={`/admin?${new URLSearchParams({ ...(q && { q }), page: String(users.page - 1) })}`}
              >
                {t("history.prev")}
              </Link>
            )}
            <span className="dim tnum">
              {t("history.pageOf", users.page, users.pageCount)}
            </span>
            {users.page < users.pageCount && (
              <Link
                className="btn btn-secondary btn-sm"
                href={`/admin?${new URLSearchParams({ ...(q && { q }), page: String(users.page + 1) })}`}
              >
                {t("history.next")}
              </Link>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
