"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient, authErrorKey } from "../../lib/auth-client";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import type { TranslationKey } from "../../lib/i18n/types";
import Alert from "../Alert";
import PasswordInput from "./PasswordInput";
import SocialButtons, { type SocialProvider } from "./SocialButtons";

export default function SignInForm({
  next,
  providers,
  notice,
  initialError,
}: {
  next: string;
  providers: SocialProvider[];
  notice: TranslationKey | null;
  initialError: TranslationKey | null;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(initialError);
  const [unverified, setUnverified] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setUnverified(false);
    setPending(true);

    const { error: failure } = await authClient.signIn.email({
      email: email.trim(),
      password,
      rememberMe: remember,
      callbackURL: "/verify-email/complete",
    });

    if (failure) {
      setPending(false);
      if (failure.code === "EMAIL_NOT_VERIFIED") {
        setUnverified(true);
        return;
      }
      setError(authErrorKey(failure));
      return;
    }

    // Full navigation, so the root layout re-renders with the new session.
    window.location.assign(next);
  }

  return (
    <div className="auth-card">
      <div>
        <h1 className="auth-title">{t("auth.signInTitle")}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {t("auth.signInDesc")}
        </p>
      </div>

      {notice && <Alert tone="success">{t(notice)}</Alert>}
      {error && <Alert tone="error">{t(error)}</Alert>}
      {unverified && (
        <Alert tone="warning" title={t("auth.verifyFirstTitle")}>
          {t("auth.verifyFirstDesc")}{" "}
          <Link
            href={`/verify-email?email=${encodeURIComponent(email.trim())}`}
          >
            {t("auth.verifyFirstLink")}
          </Link>
        </Alert>
      )}

      <SocialButtons providers={providers} callbackURL={next} />

      <form onSubmit={onSubmit} className="stack">
        <div className="field">
          <label htmlFor="email" className="field-label">
            {t("auth.email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <label htmlFor="password" className="field-label">
              {t("auth.password")}
            </label>
            <Link
              href="/forgot-password"
              style={{ fontSize: 13.5, fontWeight: 500 }}
            >
              {t("auth.forgotLink")}
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          {t("auth.rememberMe")}
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={pending}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          {pending ? t("auth.signingIn") : t("auth.signInButton")}
        </button>
      </form>

      <p className="muted" style={{ textAlign: "center", fontSize: 14.5 }}>
        {t("auth.noAccount")}{" "}
        <Link
          href={
            next === "/dashboard"
              ? "/sign-up"
              : `/sign-up?next=${encodeURIComponent(next)}`
          }
          style={{ fontWeight: 600 }}
        >
          {t("auth.createAccountLink")}
        </Link>
      </p>
    </div>
  );
}
