/**
 * Runs once when the server starts.
 *
 * Validates configuration up front — a production server with a missing
 * secret should refuse to boot rather than fail on the first sign-in — and
 * creates MongoDB indexes, which are idempotent.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getEnv } = await import("./server/env");
  const { ensureIndexes } = await import("./server/db");
  const { logger } = await import("./server/logger");

  const env = getEnv();
  logger.info("PlantGuard starting", {
    appUrl: env.APP_URL,
    database: env.mongoDbName,
    email: env.emailTransport,
    emailVerification: env.REQUIRE_EMAIL_VERIFICATION,
  });

  // Not awaited: a database that is still starting should not block the
  // server from coming up. ensureIndexes logs, and retries on next use.
  ensureIndexes().catch(() => undefined);
}
