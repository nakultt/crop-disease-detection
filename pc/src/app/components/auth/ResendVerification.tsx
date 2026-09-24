"use client";

import { useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import Alert from "../Alert";

const COOLDOWN_SECONDS = 60;

/** "Send the link again", with a cooldown that matches the server's limit. */
export default function ResendVerification({ email }: { email: string }) {
  const { t } = useLanguage();
  const [address, setAddress] = useState(email);
  const [cooldown, setCooldown] = useState(0);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"sent" | "limited" | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({
      email: address.trim(),
      callbackURL: "/verify-email/complete",
    });
    setPending(false);
    setStatus(error?.status === 429 ? "limited" : "sent");
    setCooldown(COOLDOWN_SECONDS);
  }

  return (
    <form onSubmit={resend} className="stack">
      {status === "sent" && (
        <Alert tone="success">{t("auth.resendSent")}</Alert>
      )}
      {status === "limited" && (
        <Alert tone="error">{t("authError.rateLimited")}</Alert>
      )}
      {!email && (
        <div className="field">
          <label htmlFor="email" className="field-label">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            required
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>
      )}
      <button
        type="submit"
        className="btn btn-secondary btn-block"
        disabled={pending || cooldown > 0 || !address}
      >
        {pending && <span className="spinner" aria-hidden="true" />}
        {cooldown > 0 ? t("auth.resendIn", cooldown) : t("auth.resendButton")}
      </button>
    </form>
  );
}
