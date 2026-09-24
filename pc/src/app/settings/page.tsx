import type { Metadata } from "next";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth";
import { requireSession, toViewer } from "@/server/session";
import Alert from "../components/Alert";
import { getTranslator } from "../lib/i18n/server";
import { first, type SearchParams } from "../lib/search-params";
import AppearanceSection from "./AppearanceSection";
import DataSection from "./DataSection";
import PreferencesSection from "./PreferencesSection";
import ProfileSection from "./ProfileSection";
import SecuritySection, { type SessionRow } from "./SecuritySection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("settings.title") };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession("/settings");
  const viewer = toViewer(session);
  const t = await getTranslator();
  const params = await searchParams;

  const auth = await getAuth();
  const requestHeaders = await headers();
  const [sessions, accounts] = await Promise.all([
    auth.api.listSessions({ headers: requestHeaders }),
    auth.api.listUserAccounts({ headers: requestHeaders }),
  ]);

  const hasPassword = accounts.some(
    (account) => account.providerId === "credential",
  );
  const providers = accounts
    .map((account) => account.providerId)
    .filter((provider) => provider !== "credential");

  const rows: SessionRow[] = sessions
    .map((s) => ({
      token: s.token,
      current: s.id === session.session.id,
      createdAt: new Date(s.createdAt).toISOString(),
      updatedAt: new Date(s.updatedAt).toISOString(),
      ipAddress: s.ipAddress ?? null,
      userAgent: s.userAgent ?? null,
    }))
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );

  return (
    <main id="main" className="shell page" style={{ maxWidth: 880 }}>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("settings.title")}</h1>
          <p className="page-desc">{t("settings.desc")}</p>
        </div>
      </header>

      {first(params.emailChanged) === "1" && (
        <div style={{ marginBottom: 20 }}>
          <Alert tone="success">{t("settings.emailChangeDone")}</Alert>
        </div>
      )}

      <div className="settings-stack">
        <ProfileSection viewer={viewer} />
        <PreferencesSection viewer={viewer} />
        <AppearanceSection />
        <SecuritySection
          hasPassword={hasPassword}
          providers={providers}
          sessions={rows}
        />
        <DataSection hasPassword={hasPassword} />
      </div>
    </main>
  );
}
