import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerSafe } from "@/server/session";
import Alert from "../../../components/Alert";
import ResendVerification from "../../../components/auth/ResendVerification";
import { getTranslator } from "../../../lib/i18n/server";
import { first, type SearchParams } from "../../../lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("auth.verifyTitle") };
}

/**
 * Where the emailed verification link lands. Better Auth has already checked
 * the token: on success the user is signed in, on failure `?error=` says why.
 */
export default async function VerifyEmailCompletePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslator();
  const error = first((await searchParams).error);

  if (!error) {
    if (await getViewerSafe()) redirect("/dashboard?welcome=1");
    return (
      <div className="auth-card">
        <h1 className="auth-title">{t("auth.verifiedTitle")}</h1>
        <Alert tone="success">{t("auth.verifiedDesc")}</Alert>
        <Link href="/sign-in" className="btn btn-primary btn-block">
          {t("auth.signInButton")}
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1 className="auth-title">{t("auth.verifyFailedTitle")}</h1>
      <Alert tone="error">{t("auth.verifyFailedDesc")}</Alert>
      <ResendVerification email="" />
      <p className="muted" style={{ textAlign: "center", fontSize: 14.5 }}>
        <Link href="/sign-in" style={{ fontWeight: 600 }}>
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
