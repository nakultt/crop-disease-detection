import Image from "next/image";
import Link from "next/link";
import Brand from "../components/Brand";
import LanguageSelector from "../components/LanguageSelector";
import ThemeToggle from "../components/ThemeToggle";
import { getTranslator } from "../lib/i18n/server";

/** Split screen for the auth flows: the farm on the left, the form on the right. */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslator();

  return (
    <div className="auth-layout">
      <aside className="auth-art" aria-hidden="true">
        <Image
          src="/login-bg-indian.png"
          alt=""
          fill
          priority
          // Hidden below 900px: ask for the smallest variant there.
          sizes="(min-width: 900px) 52vw, 1px"
          style={{ objectFit: "cover" }}
        />
        <div className="auth-art-caption">
          <p
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              maxWidth: "18ch",
            }}
          >
            {t("auth.artTitle")}
          </p>
          <p
            style={{
              marginTop: 10,
              fontSize: 15.5,
              opacity: 0.9,
              maxWidth: "46ch",
            }}
          >
            {t("auth.artDesc")}
          </p>
        </div>
      </aside>

      <main id="main" className="auth-main">
        <div className="auth-top">
          <Brand size="sm" />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LanguageSelector variant="compact" />
            <ThemeToggle />
          </div>
        </div>

        <div className="auth-body">{children}</div>

        <footer
          className="dim"
          style={{
            fontSize: 12.5,
            display: "flex",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <Link href="/privacy" style={{ color: "inherit" }}>
            {t("footer.privacy")}
          </Link>
          <Link href="/terms" style={{ color: "inherit" }}>
            {t("footer.terms")}
          </Link>
          <Link href="/about" style={{ color: "inherit" }}>
            {t("nav.about")}
          </Link>
        </footer>
      </main>
    </div>
  );
}
