/**
 * The public origin, for absolute URLs in metadata, the sitemap and robots.
 *
 * Read straight from the environment (not `getEnv()`): these run at build
 * time as well, when runtime secrets are rightly absent.
 */
export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
