"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Alert from "../components/Alert";
import PasswordInput from "../components/auth/PasswordInput";
import { DeviceIcon, MonitorIcon } from "../components/icons";
import LocalTime from "../components/LocalTime";
import { authClient, authErrorKey } from "../lib/auth-client";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { TranslationKey } from "../lib/i18n/types";
import { displayIp, summarizeUserAgent } from "../lib/user-agent";

export interface SessionRow {
  token: string;
  current: boolean;
  createdAt: string;
  updatedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export default function SecuritySection({
  hasPassword,
  providers,
  sessions,
}: {
  hasPassword: boolean;
  providers: string[];
  sessions: SessionRow[];
}) {
  const { t } = useLanguage();

  return (
    <section
      className="card card-pad settings-section"
      aria-labelledby="security-heading"
    >
      <div>
        <h2 id="security-heading" className="section-title">
          {t("settings.security")}
        </h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          {t("settings.securityDesc")}
        </p>
      </div>

      {hasPassword ? (
        <ChangePassword />
      ) : (
        <Alert tone="info">
          {t(
            "settings.noPassword",
            providers.map((p) => p[0].toUpperCase() + p.slice(1)).join(", ") ||
              "—",
          )}{" "}
          <Link href="/forgot-password">{t("settings.setPassword")}</Link>
        </Alert>
      )}

      <Sessions sessions={sessions} />
    </section>
  );
}

function ChangePassword() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    tone: "success" | "error";
    key: TranslationKey;
  } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    if (next.length < 8)
      return setResult({ tone: "error", key: "authError.passwordTooShort" });
    if (next !== confirm)
      return setResult({ tone: "error", key: "auth.passwordsDontMatch" });

    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: signOutOthers,
    });
    setPending(false);
    if (error) return setResult({ tone: "error", key: authErrorKey(error) });

    setCurrent("");
    setNext("");
    setConfirm("");
    setResult({ tone: "success", key: "settings.passwordChanged" });
  }

  return (
    <form
      onSubmit={submit}
      className="stack"
      aria-labelledby="password-heading"
    >
      <h3
        id="password-heading"
        className="field-label"
        style={{ fontSize: 15 }}
      >
        {t("settings.changePassword")}
      </h3>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="current-password" className="field-label">
            {t("settings.currentPassword")}
          </label>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>
        <span aria-hidden="true" className="grid-2-spacer" />
        <div className="field">
          <label htmlFor="new-password" className="field-label">
            {t("auth.newPassword")}
          </label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-password" className="field-label">
            {t("auth.confirmPassword")}
          </label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            invalid={confirm.length > 0 && confirm !== next}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={signOutOthers}
          onChange={(event) => setSignOutOthers(event.target.checked)}
        />
        {t("settings.signOutOthersOnChange")}
      </label>
      {result && <Alert tone={result.tone}>{t(result.key)}</Alert>}
      <div>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={pending || !current || !next}
        >
          {pending && (
            <span
              className="spinner"
              aria-hidden="true"
              style={{ width: 16, height: 16 }}
            />
          )}
          {t("settings.updatePassword")}
        </button>
      </div>
    </form>
  );
}

function Sessions({ sessions }: { sessions: SessionRow[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const others = sessions.filter((s) => !s.current).length;

  async function revoke(token: string) {
    setBusy(token);
    setFailed(false);
    const { error } = await authClient.revokeSession({ token });
    setBusy(null);
    if (error) setFailed(true);
    router.refresh();
  }

  async function revokeOthers() {
    setBusy("others");
    setFailed(false);
    const { error } = await authClient.revokeOtherSessions();
    setBusy(null);
    if (error) setFailed(true);
    router.refresh();
  }

  return (
    <section className="stack" aria-labelledby="sessions-heading">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h3
          id="sessions-heading"
          className="field-label"
          style={{ fontSize: 15 }}
        >
          {t("settings.sessions")}
        </h3>
        {others > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm danger-text"
            onClick={revokeOthers}
            disabled={busy !== null}
          >
            {t("settings.signOutOthers")}
          </button>
        )}
      </div>

      <ul className="session-list">
        {sessions.map((session) => {
          const device = summarizeUserAgent(session.userAgent);
          return (
            <li key={session.token} className="session-item">
              <span className="session-icon" aria-hidden="true">
                {device.mobile ? (
                  <DeviceIcon size={20} />
                ) : (
                  <MonitorIcon size={20} />
                )}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {t("settings.deviceOn", device.browser, device.os)}
                  {session.current && (
                    <span className="badge badge-primary">
                      {t("settings.thisDevice")}
                    </span>
                  )}
                </div>
                <div className="dim" style={{ fontSize: 13 }}>
                  {displayIp(session.ipAddress)
                    ? `${displayIp(session.ipAddress)} · `
                    : ""}
                  {t("settings.lastActive")}{" "}
                  <LocalTime iso={session.updatedAt} kind="relative" />
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => revoke(session.token)}
                  disabled={busy !== null}
                >
                  {busy === session.token
                    ? t("settings.signingOut")
                    : t("nav.signOut")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {failed && <p className="field-error">{t("authError.generic")}</p>}
    </section>
  );
}
