"use client";

import { useState } from "react";
import { authClient } from "../../lib/auth-client";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import { GitHubIcon, GoogleIcon } from "../icons";

export type SocialProvider = "google" | "github";

export default function SocialButtons({
  providers,
  callbackURL,
}: {
  providers: SocialProvider[];
  callbackURL: string;
}) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<SocialProvider | null>(null);

  if (providers.length === 0) return null;

  return (
    <div className="stack" style={{ gap: 10 }}>
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          className="btn btn-secondary btn-block"
          disabled={pending !== null}
          onClick={async () => {
            setPending(provider);
            const { error } = await authClient.signIn.social({
              provider,
              callbackURL,
              errorCallbackURL: "/sign-in?error=oauth",
            });
            // On success the browser is already navigating to the provider.
            if (error) setPending(null);
          }}
        >
          {provider === "google" ? <GoogleIcon /> : <GitHubIcon />}
          {provider === "google"
            ? t("auth.continueWithGoogle")
            : t("auth.continueWithGitHub")}
        </button>
      ))}
      <div className="divider-text">{t("auth.or")}</div>
    </div>
  );
}
