import type { Metadata } from "next";
import Link from "next/link";
import ResendVerification from "../../components/auth/ResendVerification";
import { MailIcon } from "../../components/icons";
import { getTranslator } from "../../lib/i18n/server";
import { first, type SearchParams } from "../../lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("auth.verifyTitle") };
}

/** "Check your inbox", shown right after sign-up. */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslator();
  const email = (first((await searchParams).email) ?? "").slice(0, 254);

  return (
    <div className="auth-card">
      <span
        className="empty-state-icon"
        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      >
        <MailIcon size={28} />
      </span>
      <div>
        <h1 className="auth-title">{t("auth.verifyTitle")}</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {email ? t("auth.verifySentTo", email) : t("auth.verifySent")}
        </p>
        <p className="dim" style={{ marginTop: 8, fontSize: 14 }}>
          {t("auth.verifySpamHint")}
        </p>
      </div>
      <ResendVerification email={email} />
      <p className="muted" style={{ textAlign: "center", fontSize: 14.5 }}>
        <Link href="/sign-in" style={{ fontWeight: 600 }}>
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
