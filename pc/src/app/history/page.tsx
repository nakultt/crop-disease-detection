import type { Metadata } from "next";
import Link from "next/link";
import { getServerManifest } from "@/server/model-manifest";
import { listScans, scannedCrops } from "@/server/scans";
import { requireSession, toViewer } from "@/server/session";
import {
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  HistoryIcon,
  SearchIcon,
} from "../components/icons";
import ScanCard from "../components/ScanCard";
import { getTranslator } from "../lib/i18n/server";
import { type ScanFilters, scanFiltersSchema } from "../lib/scan-contract";
import { first, type SearchParams } from "../lib/search-params";
import { SEVERITY_ORDER } from "../lib/severity";
import HistoryFilters from "./HistoryFilters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("history.title") };
}

function queryString(
  filters: ScanFilters,
  overrides: Partial<Record<string, string>> = {},
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.crop) params.set("crop", filters.crop);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const viewer = toViewer(await requireSession("/history"));
  const t = await getTranslator();

  const raw = await searchParams;
  const filters = scanFiltersSchema.parse(
    Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, first(value)]),
    ),
  );

  const [page, crops, manifest] = await Promise.all([
    listScans(viewer.id, filters),
    scannedCrops(viewer.id),
    getServerManifest(),
  ]);

  const filtered =
    Boolean(filters.q) ||
    Boolean(filters.crop) ||
    filters.status !== "all" ||
    Boolean(filters.severity);
  const neverScanned = page.total === 0 && !filtered;

  return (
    <main id="main" className="shell page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("history.title")}</h1>
          <p className="page-desc">{t("history.desc")}</p>
        </div>
        {!neverScanned && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <a
              href={`/api/scans/export${queryString(filters)}`}
              className="btn btn-secondary btn-sm"
              download
            >
              <DownloadIcon size={16} />
              {t("history.export")}
            </a>
            <Link href="/scan" className="btn btn-primary btn-sm">
              <CameraIcon size={16} />
              {t("dash.newScan")}
            </Link>
          </div>
        )}
      </header>

      {neverScanned ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <HistoryIcon size={28} />
          </span>
          <h2 style={{ fontSize: 18, fontWeight: 650 }}>
            {t("history.emptyTitle")}
          </h2>
          <p className="muted" style={{ maxWidth: 420 }}>
            {t("history.emptyDesc")}
          </p>
          <Link
            href="/scan"
            className="btn btn-primary"
            style={{ marginTop: 8 }}
          >
            <CameraIcon size={18} />
            {t("dash.newScan")}
          </Link>
        </div>
      ) : (
        <>
          <HistoryFilters
            crops={crops}
            levels={manifest?.classes.severity ?? SEVERITY_ORDER}
            filters={filters}
          />

          {page.total === 0 ? (
            <div className="empty-state" style={{ marginTop: 20 }}>
              <span className="empty-state-icon">
                <SearchIcon size={26} />
              </span>
              <h2 style={{ fontSize: 18, fontWeight: 650 }}>
                {t("history.noMatchTitle")}
              </h2>
              <p className="muted">{t("history.noMatchDesc")}</p>
              <Link
                href="/history"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 6 }}
              >
                {t("history.clear")}
              </Link>
            </div>
          ) : (
            <>
              <p
                className="dim"
                style={{ fontSize: 13.5, margin: "18px 0 12px" }}
                aria-live="polite"
              >
                {t("history.total", page.total)}
              </p>
              <div className="scan-grid">
                {page.items.map((scan) => (
                  <ScanCard key={scan.id} scan={scan} />
                ))}
              </div>

              {page.pageCount > 1 && (
                <nav
                  className="pagination"
                  aria-label={t("history.pagination")}
                >
                  {page.page > 1 ? (
                    <Link
                      className="btn btn-secondary btn-sm"
                      href={`/history${queryString(filters, { page: String(page.page - 1) })}`}
                      rel="prev"
                    >
                      <ChevronLeftIcon size={16} />
                      {t("history.prev")}
                    </Link>
                  ) : (
                    <span
                      className="btn btn-secondary btn-sm"
                      aria-disabled="true"
                      style={{ opacity: 0.45 }}
                    >
                      <ChevronLeftIcon size={16} />
                      {t("history.prev")}
                    </span>
                  )}
                  <span className="dim tnum" style={{ fontSize: 14 }}>
                    {t("history.pageOf", page.page, page.pageCount)}
                  </span>
                  {page.page < page.pageCount ? (
                    <Link
                      className="btn btn-secondary btn-sm"
                      href={`/history${queryString(filters, { page: String(page.page + 1) })}`}
                      rel="next"
                    >
                      {t("history.next")}
                      <ChevronRightIcon size={16} />
                    </Link>
                  ) : (
                    <span
                      className="btn btn-secondary btn-sm"
                      aria-disabled="true"
                      style={{ opacity: 0.45 }}
                    >
                      {t("history.next")}
                      <ChevronRightIcon size={16} />
                    </span>
                  )}
                </nav>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
