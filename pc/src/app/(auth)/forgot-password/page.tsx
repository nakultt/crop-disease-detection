import type { Metadata } from "next";
import ForgotPasswordForm from "../../components/auth/ForgotPasswordForm";
import { getTranslator } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("auth.forgotTitle") };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
