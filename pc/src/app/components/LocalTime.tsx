"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n/LanguageContext";

type Format = "date" | "datetime" | "relative";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

function relative(date: Date, locale: string): string {
  const seconds = (date.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size)
      return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, "minute");
}

function format(date: Date, kind: Format, locale: string): string {
  if (kind === "relative") return relative(date, locale);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(kind === "datetime" ? { timeStyle: "short" } : {}),
  }).format(date);
}

/**
 * A timestamp in the reader's own time zone and language.
 *
 * The server does not know the reader's time zone, so it renders a neutral
 * UTC date; the browser swaps in the local rendering after hydration. Doing
 * it in render instead would make server and client disagree near midnight.
 */
export default function LocalTime({
  iso,
  kind = "date",
}: {
  iso: string;
  kind?: Format;
}) {
  const { language } = useLanguage();
  const [text, setText] = useState(() => iso.slice(0, 10));

  useEffect(() => {
    setText(format(new Date(iso), kind, language));
  }, [iso, kind, language]);

  return (
    <time dateTime={iso} title={new Date(iso).toUTCString()}>
      {text}
    </time>
  );
}
