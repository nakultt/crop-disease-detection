"use client";

import { useState } from "react";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import { EyeIcon, EyeOffIcon } from "../icons";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  invalid?: boolean;
};

/** Password field with a show/hide toggle — fewer typos on a phone keyboard. */
export default function PasswordInput({ invalid, ...props }: Props) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <div className="input-group">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className="input"
        aria-invalid={invalid || undefined}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="input-addon"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  );
}

/** A rough strength score, 0–4, for the sign-up meter. */
export function passwordStrength(password: string): number {
  if (password.length < 8) return 0;
  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(4, score);
}
