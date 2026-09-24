import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEnv } from "@/server/env";
import { enabledProviders } from "@/server/providers";
import { getViewerSafe } from "@/server/session";
import Alert from "../../components/Alert";
import SignUpForm from "../../components/auth/SignUpForm";
import { getTranslator } from "../../lib/i18n/server";
import { safeReturnPath } from "../../lib/routes";
import { first, type SearchParams } from "../../lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("auth.signUpTitle") };
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = safeReturnPath(first(params.next));

  if (await getViewerSafe()) redirect(next);

  const env = getEnv();
  if (env.DISABLE_SIGNUPS) {
    const t = await getTranslator();
    return (
      <div className="auth-card">
        <h1 className="auth-title">{t("auth.signUpTitle")}</h1>
        <Alert tone="info" title={t("auth.signupsClosedTitle")}>
          {t("auth.signupsClosedDesc")}
        </Alert>
        <Link href="/sign-in" className="btn btn-primary btn-block">
          {t("auth.signInButton")}
        </Link>
      </div>
    );
  }

  return (
    <SignUpForm
      next={next}
      providers={enabledProviders()}
      requireVerification={env.REQUIRE_EMAIL_VERIFICATION}
    />
  );
}
