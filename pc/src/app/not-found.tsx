import Link from "next/link";
import { LeafIcon } from "./components/icons";
import { getTranslator } from "./lib/i18n/server";

export default async function NotFound() {
  const t = await getTranslator();

  return (
    <main id="main" className="shell page status-page">
      <span className="status-code" aria-hidden="true">
        404
      </span>
      <span
        className="feature-icon"
        aria-hidden="true"
        style={{ width: 64, height: 64, borderRadius: 20 }}
      >
        <LeafIcon size={30} />
      </span>
      <h1 className="page-title">{t("error.notFoundTitle")}</h1>
      <p className="page-desc" style={{ textAlign: "center" }}>
        {t("error.notFoundDesc")}
      </p>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link href="/" className="btn btn-primary">
          {t("error.home")}
        </Link>
        <Link href="/crops" className="btn btn-secondary">
          {t("nav.crops")}
        </Link>
      </div>
    </main>
  );
}
