/**
 * A short day-and-month label ("3 Aug") for a UTC date.
 *
 * Call this on the server and pass the string down. Node and browsers ship
 * different locale data, so the same date can format differently on each side
 * (Tamil puts the month first in one and last in the other), and text that
 * differs between the server render and the client breaks hydration.
 */
export function shortDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}
