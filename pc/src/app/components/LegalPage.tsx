import { getLanguage, getTranslator } from "../lib/i18n/server";

/**
 * Shared frame for the legal pages. The text itself is English only: a
 * translated policy is a separate legal document and must be reviewed as one,
 * so non-English readers are told which version governs.
 */
export default async function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  const [t, language] = await Promise.all([getTranslator(), getLanguage()]);

  return (
    <main id="main" className="shell page" style={{ maxWidth: 820 }}>
      <article className="legal">
        <header style={{ marginBottom: 28 }}>
          <h1 className="page-title">{title}</h1>
          <p className="dim" style={{ marginTop: 8 }}>
            {t("legal.updated", updated)}
          </p>
          {language !== "en" && (
            <p
              className="alert alert-info"
              style={{ marginTop: 16 }}
              lang={language}
            >
              {t("legal.englishOnly")}
            </p>
          )}
        </header>
        <div lang="en">{children}</div>
      </article>
    </main>
  );
}
