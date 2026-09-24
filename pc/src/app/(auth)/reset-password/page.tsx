import type { Metadata } from "next";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";
import { getTranslator } from "../../lib/i18n/server";
import { first, type SearchParams } from "../../lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("auth.resetTitle") };
}

/**
 * Better Auth's emailed link validates the token, then lands here with
 * `?token=…` — or with `?error=INVALID_TOKEN` when it was expired or used.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const token = first(params.error) ? null : (first(params.token) ?? null);
  return <ResetPasswordForm token={token} />;
}
