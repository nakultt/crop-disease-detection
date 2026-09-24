/**
 * Just enough User-Agent parsing to label a session "Chrome on Android" in
 * the active-sessions list. Deliberately small: exact versions do not help a
 * user decide whether a session is theirs.
 */

export interface DeviceSummary {
  browser: string;
  os: string;
  mobile: boolean;
}

const BROWSERS: [RegExp, string][] = [
  [/EdgA?\/|Edg\//, "Edge"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Windows NT/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

/**
 * An IP address for display: IPv6 in its short form, and nothing at all for
 * loopback or unspecified addresses, which say nothing useful to a user.
 */
export function displayIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let value = ip.trim();

  if (value.includes(":")) {
    const groups = value.split(":");
    if (
      groups.length === 8 &&
      groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))
    ) {
      const short = groups.map((g) => g.replace(/^0+(?=.)/, "").toLowerCase());
      // Collapse the longest run of zero groups into "::".
      let best = { start: -1, length: 0 };
      for (let i = 0; i < short.length; ) {
        if (short[i] !== "0") {
          i++;
          continue;
        }
        let j = i;
        while (j < short.length && short[j] === "0") j++;
        if (j - i > best.length) best = { start: i, length: j - i };
        i = j;
      }
      value =
        best.length > 1
          ? `${short.slice(0, best.start).join(":")}::${short.slice(best.start + best.length).join(":")}`
          : short.join(":");
    }
  }

  if (
    value === "::" ||
    value === "::1" ||
    value === "127.0.0.1" ||
    value === "0.0.0.0"
  )
    return null;
  return value;
}

export function summarizeUserAgent(
  userAgent: string | null | undefined,
): DeviceSummary {
  const ua = userAgent ?? "";
  const browser =
    BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? "Browser";
  const os =
    SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? "Unknown device";
  return { browser, os, mobile: /Mobi|Android|iPhone|iPad/.test(ua) };
}
