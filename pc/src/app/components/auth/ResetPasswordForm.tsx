"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient, authErrorKey } from "../../lib/auth-client";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import type { TranslationKey } from "../../lib/i18n/types";
import Alert from "../Alert";
import PasswordInput from "./PasswordInput";

export default function ResetPasswordForm({ token }: { token: string | null }) {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(
    token ? null : "authError.invalidToken",
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("authError.invalidToken");
      return;
    }
    if (password.length < 8) {
      setError("authError.passwordTooShort");
      return;
    }
    if (password !== confirm) {
      setError("auth.passwordsDontMatch");
      return;
    }

    setPending(true);
    const { error: failure } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    if (failure) {
      setPending(false);
      setError(authErrorKey(failure));
      return;
    }
    window.location.assign("/sign-in?reset=1");
  }

  return (
    <div className="auth-card">
      <div>
        <h1 className="auth-title">{t("auth.resetTitle")}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {t("auth.resetDesc")}
        </p>
      </div>

      {error && (
        <Alert tone="error">
          {t(error)}
          {error === "authError.invalidToken" && (
            <>
              {" "}
              <Link href="/forgot-password">{t("auth.requestNewLink")}</Link>
            </>
          )}
        </Alert>
      )}

      {token && (
        <form onSubmit={onSubmit} className="stack">
          <div className="field">
            <label htmlFor="password" className="field-label">
              {t("auth.newPassword")}
            </label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <span className="field-help">{t("auth.passwordHint")}</span>
          </div>
          <div className="field">
            <label htmlFor="confirm" className="field-label">
              {t("auth.confirmPassword")}
            </label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              required
              value={confirm}
              invalid={confirm.length > 0 && confirm !== password}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={pending}
          >
            {pending && <span className="spinner" aria-hidden="true" />}
            {t("auth.resetButton")}
          </button>
        </form>
      )}

      <p className="muted" style={{ textAlign: "center", fontSize: 14.5 }}>
        <Link href="/sign-in" style={{ fontWeight: 600 }}>
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
