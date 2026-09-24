"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import Alert from "../Alert";

export default function ForgotPasswordForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [limited, setLimited] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setLimited(false);
    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error?.status === 429) {
      setLimited(true);
      return;
    }
    // Same confirmation whether or not the address has an account, so this
    // form cannot be used to discover who is registered.
    setSent(true);
  }

  return (
    <div className="auth-card">
      <div>
        <h1 className="auth-title">{t("auth.forgotTitle")}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {t("auth.forgotDesc")}
        </p>
      </div>

      {sent ? (
        <Alert tone="success" title={t("auth.forgotSentTitle")}>
          {t("auth.forgotSentDesc")}
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="stack">
          {limited && <Alert tone="error">{t("authError.rateLimited")}</Alert>}
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
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={pending}
          >
            {pending && <span className="spinner" aria-hidden="true" />}
            {t("auth.sendResetLink")}
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
