/**
 * Route groups, shared by the proxy (server) and the app shell (client).
 * Kept dependency-free: the proxy runs on every request.
 */

/** Pages that need a signed-in user. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/scan",
  "/history",
  "/settings",
  "/admin",
] as const;

/** Auth screens, rendered without the app chrome. */
export const AUTH_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
] as const;

export function matchesPrefix(
  pathname: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Where a signed-in user lands by default. */
export const HOME_PATH = "/dashboard";

/**
 * Only same-site relative paths are accepted as a post-sign-in destination;
 * anything else (`//evil.example`, `https://…`, backslash tricks) becomes the
 * default. Prevents the sign-in page from being an open redirect.
 */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return HOME_PATH;
  }
  if (value.includes("\\") || /[\r\n\t]/.test(value)) return HOME_PATH;
  if (matchesPrefix(value.split(/[?#]/)[0], AUTH_PREFIXES)) return HOME_PATH;
  return value;
}
