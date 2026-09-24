import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { enabledProviders } from "@/server/providers";
import { getViewerSafe } from "@/server/session";
import SignInForm from "../../components/auth/SignInForm";
import { getTranslator } from "../../lib/i18n/server";
import type { TranslationKey } from "../../lib/i18n/types";
import { safeReturnPath } from "../../lib/routes";
import { first, type SearchParams } from "../../lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("auth.signInTitle") };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = safeReturnPath(first(params.next));

  if (await getViewerSafe()) redirect(next);

  const notice: TranslationKey | null =
    first(params.reset) === "1"
      ? "auth.resetDone"
      : first(params.deleted) === "1"
        ? "auth.accountDeleted"
        : null;

  const error = first(params.error);
  const initialError: TranslationKey | null = !error
    ? null
    : error === "oauth"
      ? "authError.oauth"
      : "authError.generic";

  return (
    <SignInForm
      next={next}
      providers={enabledProviders()}
      notice={notice}
      initialError={initialError}
    />
  );
}
