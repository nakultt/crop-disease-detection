import "server-only";
import { type Db, MongoClient } from "mongodb";
import { getEnv } from "./env";
import { logger } from "./logger";

/**
 * One MongoClient per process.
 *
 * The client pools connections internally, so creating one per request would
 * exhaust the server. In development the module is re-evaluated on every hot
 * reload, so the instance lives on `globalThis` to survive that.
 */

interface MongoHandle {
  client: MongoClient;
  db: Db;
}

const globalForMongo = globalThis as typeof globalThis & {
  __plantguardMongo?: MongoHandle;
  __plantguardIndexes?: Promise<void>;
};

export function getMongo(): MongoHandle {
  if (!globalForMongo.__plantguardMongo) {
    const env = getEnv();
    const client = new MongoClient(env.MONGODB_URI, {
      appName: "plantguard-web",
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 8000,
    });
    globalForMongo.__plantguardMongo = {
      client,
      db: client.db(env.mongoDbName),
    };
  }
  return globalForMongo.__plantguardMongo;
}

export function getDb(): Db {
  return getMongo().db;
}

/** Collection names owned by this app (Better Auth owns its own). */
export const COLLECTIONS = {
  scans: "scans",
  scanImages: "scan_images",
  rateLimits: "rate_limits",
  user: "user",
  session: "session",
  account: "account",
  verification: "verification",
  authRateLimit: "rateLimit",
} as const;

/**
 * Multi-document transactions need a replica set or sharded cluster. Atlas is
 * always one; a bare local `mongod` is not, and asking it for a transaction
 * fails every write, so detect rather than assume.
 */
export async function supportsTransactions(): Promise<boolean> {
  try {
    const hello = await getDb().admin().command({ hello: 1 });
    return Boolean(hello.setName) || hello.msg === "isdbgrid";
  } catch (error) {
    logger.warn("Could not determine MongoDB topology", { err: error });
    return false;
  }
}

async function createIndexes(): Promise<void> {
  const db = getDb();

  await Promise.all([
    // Scans are always read per user, newest first.
    db
      .collection(COLLECTIONS.scans)
      .createIndexes([
        { key: { userId: 1, createdAt: -1 }, name: "user_recent" },
        {
          key: { userId: 1, "disease.crop": 1, createdAt: -1 },
          name: "user_crop",
        },
        {
          key: { userId: 1, "disease.healthy": 1, createdAt: -1 },
          name: "user_health",
        },
      ]),
    db
      .collection(COLLECTIONS.scanImages)
      .createIndexes([{ key: { userId: 1 }, name: "user" }]),
    db.collection(COLLECTIONS.rateLimits).createIndexes([
      // TTL: MongoDB drops expired windows on its own.
      { key: { expiresAt: 1 }, name: "ttl", expireAfterSeconds: 0 },
    ]),

    // Better Auth's MongoDB adapter creates no indexes itself. Without these,
    // every session lookup is a collection scan, and nothing stops two
    // concurrent sign-ups from creating duplicate users for one email.
    db
      .collection(COLLECTIONS.user)
      .createIndexes([
        { key: { email: 1 }, name: "email_unique", unique: true },
      ]),
    db.collection(COLLECTIONS.session).createIndexes([
      { key: { token: 1 }, name: "token_unique", unique: true },
      { key: { userId: 1 }, name: "user" },
      { key: { expiresAt: 1 }, name: "ttl", expireAfterSeconds: 0 },
    ]),
    db.collection(COLLECTIONS.account).createIndexes([
      { key: { userId: 1 }, name: "user" },
      { key: { providerId: 1, accountId: 1 }, name: "provider_account" },
    ]),
    db.collection(COLLECTIONS.verification).createIndexes([
      { key: { identifier: 1 }, name: "identifier" },
      { key: { expiresAt: 1 }, name: "ttl", expireAfterSeconds: 0 },
    ]),
    db
      .collection(COLLECTIONS.authRateLimit)
      .createIndexes([{ key: { key: 1 }, name: "key" }]),
  ]);
}

/**
 * Create indexes once per process. Idempotent, so it is safe on every boot; a
 * failure is not cached, so a database that was briefly unreachable at
 * startup gets another attempt on the next call.
 */
export function ensureIndexes(): Promise<void> {
  globalForMongo.__plantguardIndexes ??= createIndexes()
    .then(() => logger.info("MongoDB indexes ready"))
    .catch((error) => {
      globalForMongo.__plantguardIndexes = undefined;
      logger.error("Failed to create MongoDB indexes", { err: error });
      throw error;
    });
  return globalForMongo.__plantguardIndexes;
}

/** Round-trip to the server; used by the health check. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await getDb().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
