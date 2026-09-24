"use client";

import { useId } from "react";
import { isLanguageCode, LANGUAGES } from "../lib/i18n/config";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { GlobeIcon } from "./icons";

/**
 * Language picker.
 *
 * A native `<select>`: on the phones most farmers use, it opens the
 * platform's own picker, and it is keyboard- and screen-reader-accessible
 * without any custom focus management.
 */
export default function LanguageSelector({
  variant = "full",
}: {
  variant?: "full" | "compact";
}) {
  const { language, setLanguage, switching, t } = useLanguage();
  const id = useId();

  const select = (
    <select
      id={id}
      className={variant === "compact" ? "select select-compact" : "select"}
      value={language}
      disabled={switching}
      aria-label={t("settings.displayLanguage")}
      onChange={(event) => {
        const next = event.target.value;
        if (isLanguageCode(next)) void setLanguage(next);
      }}
    >
      {LANGUAGES.map((option) => (
        <option key={option.code} value={option.code} lang={option.code}>
          {variant === "compact"
            ? option.nativeName
            : option.code === "en"
              ? option.name
              : `${option.nativeName} — ${option.name}`}
        </option>
      ))}
    </select>
  );

  if (variant === "compact") {
    return (
      <span className="lang-compact">
        <GlobeIcon size={16} />
        {select}
      </span>
    );
  }

  return select;
}
