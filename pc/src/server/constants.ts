/**
 * Kept free of imports so the proxy — which runs on every request — does not
 * pull Better Auth and the MongoDB driver into its bundle.
 */

/** Session cookies are named `plantguard.session_token` and so on. */
export const COOKIE_PREFIX = "plantguard";
