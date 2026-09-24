"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SearchIcon, XIcon } from "../components/icons";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { cropNameLabel } from "../lib/labels";
import type { ScanFilters } from "../lib/scan-contract";
import { severityLabel } from "../lib/severity";

/**
 * History filters. State lives in the URL, so a filtered view can be
 * bookmarked, shared, reloaded, and exported with the same query.
 */
export default function HistoryFilters({
  crops,
  levels,
  filters,
}: {
  crops: string[];
  levels: string[];
  filters: ScanFilters;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");
  const firstRender = useRef(true);

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (
        value === undefined ||
        value === "" ||
        value === "all" ||
        value === "newest"
      ) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    next.delete("page");
    const search = next.toString();
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  // Debounce typing so every keystroke is not a server round-trip.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the query text should trigger this.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(
      () => update({ q: query.trim() || undefined }),
      350,
    );
    return () => clearTimeout(timer);
  }, [query]);

  const active =
    Boolean(filters.q) ||
    Boolean(filters.crop) ||
    filters.status !== "all" ||
    Boolean(filters.severity);

  return (
    <search
      className="filters"
      aria-label={t("history.filtersLabel")}
      data-pending={pending || undefined}
    >
      <div className="filters-search">
        <SearchIcon size={18} />
        <input
          type="search"
          className="input"
          aria-label={t("history.searchLabel")}
          placeholder={t("history.searchPlaceholder")}
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <select
        className="select"
        aria-label={t("history.crop")}
        value={filters.crop ?? ""}
        onChange={(event) => update({ crop: event.target.value || undefined })}
      >
        <option value="">{t("history.allCrops")}</option>
        {crops.map((crop) => (
          <option key={crop} value={crop}>
            {cropNameLabel(crop, t)}
          </option>
        ))}
      </select>

      <fieldset className="segmented" style={{ border: 0, margin: 0 }}>
        <legend className="sr-only">{t("history.status")}</legend>
        {(["all", "diseased", "healthy"] as const).map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filters.status === status}
            onClick={() =>
              update({
                status,
                severity: status === "healthy" ? undefined : filters.severity,
              })
            }
          >
            {status === "all"
              ? t("history.all")
              : status === "diseased"
                ? t("history.diseased")
                : t("history.healthy")}
          </button>
        ))}
      </fieldset>

      <select
        className="select"
        aria-label={t("history.severity")}
        value={filters.severity ?? ""}
        disabled={filters.status === "healthy"}
        onChange={(event) =>
          update({ severity: event.target.value || undefined })
        }
      >
        <option value="">{t("history.anySeverity")}</option>
        {levels.map((level) => (
          <option key={level} value={level}>
            {severityLabel(level, t)}
          </option>
        ))}
      </select>

      <select
        className="select"
        aria-label={t("history.sort")}
        value={filters.sort}
        onChange={(event) => update({ sort: event.target.value })}
      >
        <option value="newest">{t("history.newest")}</option>
        <option value="oldest">{t("history.oldest")}</option>
      </select>

      {active && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setQuery("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <XIcon size={16} />
          {t("history.clear")}
        </button>
      )}
    </search>
  );
}
