"use client";

import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { LogOutIcon } from "./icons";

export default function SignOutButton({
  className = "nav-link",
}: {
  className?: string;
}) {
  const { t } = useLanguage();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut().catch(() => undefined);
        // A full navigation drops every client-side cache of the signed-in
        // state, including the shell rendered by the root layout.
        window.location.assign("/");
      }}
    >
      <LogOutIcon />
      {t("nav.signOut")}
    </button>
  );
}
