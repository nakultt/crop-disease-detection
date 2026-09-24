import "server-only";
import { COLLECTIONS, getDb } from "./db";

/**
 * Fixed-window rate limiting backed by MongoDB, so the limit holds across
 * every instance of the app rather than per process.
 *
 * Each window is its own document keyed by `key:windowIndex`, incremented
 * atomically with an upsert; a TTL index removes it once the window closes.
 * That makes a check a single round-trip with no read-then-write race.
 */

interface WindowDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfter: number;
}

export async function consumeRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowIndex = Math.floor(now / windowMs);
  const resetAt = (windowIndex + 1) * windowMs;

  const doc = await getDb()
    .collection<WindowDoc>(COLLECTIONS.rateLimits)
    .findOneAndUpdate(
      { _id: `${key}:${windowIndex}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(resetAt) } },
      { upsert: true, returnDocument: "after" },
    );

  const count = doc?.count ?? 1;
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}
