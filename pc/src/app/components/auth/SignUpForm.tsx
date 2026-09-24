"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, authErrorKey } from "../../lib/auth-client";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import type { TranslationKey } from "../../lib/i18n/types";
import Alert from "../Alert";
import PasswordInput, { passwordStrength } from "./PasswordInput";
import SocialButtons, { type SocialProvider } from "./SocialButtons";

const STRENGTH_KEYS: TranslationKey[] = [
  "auth.strength0",
  "auth.strength1",
  "auth.strength2",
  "auth.strength3",
  "auth.strength4",
];

const STRENGTH_COLORS = [
  "var(--critical)",
  "var(--severe)",
  "var(--moderate)",
  "var(--mild)",
  "var(--mild)",
];

export default function SignUpForm({
  next,
  providers,
  requireVerification,
}: {
  next: string;
  providers: SocialProvider[];
  requireVerification: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  const strength = passwordStrength(password);
  const tooShort = password.length > 0 && password.length < 8;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("authError.passwordTooShort");
      return;
    }
    if (!accepted) {
      setError("auth.mustAcceptTerms");
      return;
    }

    setPending(true);
    const trimmedEmail = email.trim();
    const { error: failure } = await authClient.signUp.email({
      name: name.trim(),
      email: trimmedEmail,
      password,
      callbackURL: "/verify-email/complete",
    });

    if (failure) {
      setPending(false);
      setError(authErrorKey(failure));
      return;
    }

    if (requireVerification) {
      router.push(`/verify-email?email=${encodeURIComponent(trimmedEmail)}`);
    } else {
      window.location.assign(
        next === "/dashboard" ? "/dashboard?welcome=1" : next,
      );
    }
  }

  return (
    <div className="auth-card">
      <div>
        <h1 className="auth-title">{t("auth.signUpTitle")}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {t("auth.signUpDesc")}
        </p>
      </div>

      {error && <Alert tone="error">{t(error)}</Alert>}

      <SocialButtons providers={providers} callbackURL="/dashboard?welcome=1" />

      <form onSubmit={onSubmit} className="stack">
        <div className="field">
          <label htmlFor="name" className="field-label">
            {t("auth.name")}
          </label>
          <input
            id="name"
            name="name"
            className="input"
            autoComplete="name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

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
          <label htmlFor="password" className="field-label">
            {t("auth.password")}
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            invalid={tooShort}
            aria-describedby="password-help"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div id="password-help" className="field-help" aria-live="polite">
            {password.length === 0 ? (
              t("auth.passwordHint")
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="meter" style={{ flex: 1, height: 6 }}>
                  <i
                    style={{
                      width: `${Math.max(1, strength) * 25}%`,
                      background: STRENGTH_COLORS[strength],
                    }}
                  />
                </span>
                <span
                  style={{ color: STRENGTH_COLORS[strength], fontWeight: 600 }}
                >
                  {t(STRENGTH_KEYS[strength])}
                </span>
              </span>
            )}
          </div>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            required
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            {t("auth.acceptPrefix")}{" "}
            <Link href="/terms" target="_blank">
              {t("footer.terms")}
            </Link>{" "}
            {t("auth.acceptAnd")}{" "}
            <Link href="/privacy" target="_blank">
              {t("footer.privacy")}
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={pending}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          {pending ? t("auth.creatingAccount") : t("auth.signUpButton")}
        </button>
      </form>

      <p className="muted" style={{ textAlign: "center", fontSize: 14.5 }}>
        {t("auth.haveAccount")}{" "}
        <Link href="/sign-in" style={{ fontWeight: 600 }}>
          {t("auth.signInLink")}
        </Link>
      </p>
    </div>
  );
}
