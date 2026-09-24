"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertIcon } from "./components/icons";
import { useLanguage } from "./lib/i18n/LanguageContext";

/** Shown when a page throws. The digest ties this screen to the server log line. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="shell page status-page">
      <span
        className="feature-icon"
        aria-hidden="true"
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: "var(--critical-soft)",
          color: "var(--critical)",
        }}
      >
        <AlertIcon size={30} />
      </span>
      <h1 className="page-title">{t("error.title")}</h1>
      <p className="page-desc" style={{ textAlign: "center" }}>
        {t("error.desc")}
      </p>
      {error.digest && (
        <p className="dim mono" style={{ fontSize: 12.5 }}>
          {t("error.reference", error.digest)}
        </p>
      )}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button type="button" className="btn btn-primary" onClick={reset}>
          {t("error.retry")}
        </button>
        <Link href="/" className="btn btn-secondary">
          {t("error.home")}
        </Link>
      </div>
    </main>
  );
}
