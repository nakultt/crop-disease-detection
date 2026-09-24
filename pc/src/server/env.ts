import "server-only";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { logger } from "./logger";

/**
 * Server configuration, validated once.
 *
 * Everything the server reads from the environment goes through here, so a
 * malformed value fails at startup with a message naming the variable — not
 * later as a confusing auth or database error. See `.env.example` for what
 * each variable does.
 *
 * Nothing is required: a fresh clone runs against a local MongoDB with no
 * `.env` file at all. Set the variables before exposing the app publicly.
 */

const list = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  APP_URL: z
    .url({ protocol: /^https?$/ })
    .default("http://localhost:3000")
    .transform((value) => value.replace(/\/+$/, "")),

  BETTER_AUTH_SECRET: optionalString.pipe(
    z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters.")
      .optional(),
  ),

  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must be a mongodb:// URI.")
    .default("mongodb://127.0.0.1:27017/plantguard"),
  MONGODB_DB: optionalString,

  SMTP_URL: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_SECURE: z.stringbool().optional(),
  EMAIL_FROM: z.string().default("PlantGuard <no-reply@plantguard.local>"),
  MAIL_OUTBOX_DIR: optionalString,

  // Off by default so a local install works without an email server.
  REQUIRE_EMAIL_VERIFICATION: z.stringbool().default(false),
  DISABLE_SIGNUPS: z.stringbool().default(false),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,

  ADMIN_EMAILS: list.transform((emails) =>
    emails.map((email) => email.toLowerCase()),
  ),
  TRUSTED_ORIGINS: list,

  COMPANY_NAME: z.string().default("PlantGuard"),
  SUPPORT_EMAIL: optionalString.pipe(z.email().optional()),

  MAX_SCANS_PER_USER: z.coerce.number().int().positive().default(5000),
  SCAN_UPLOADS_PER_MINUTE: z.coerce.number().int().positive().default(30),
});

export type Env = Omit<z.infer<typeof schema>, "BETTER_AUTH_SECRET"> & {
  /** Always set: the configured secret, or a generated local one. */
  BETTER_AUTH_SECRET: string;
  /** Database name: `MONGODB_DB`, else the URI's path, else `plantguard`. */
  mongoDbName: string;
  emailTransport: "smtp" | "file" | "console";
  isProduction: boolean;
  /** False when APP_URL is the local default rather than a set value. */
  appUrlConfigured: boolean;
};

/** Fallback for `parseEnv` callers that don't supply one (tests). */
const TEST_SECRET = "plantguard-test-secret-not-for-real-use-0123456789";

/**
 * Where a generated secret is kept: `PLANTGUARD_DATA_DIR` (set by
 * `npm run start:standalone`, whose server changes directory into the
 * build output), else `.data/` in the working directory.
 */
function localSecretFile(): string {
  const dir =
    process.env.PLANTGUARD_DATA_DIR ?? path.join(process.cwd(), ".data");
  return path.resolve(dir, "auth-secret");
}

/**
 * The secret to use when BETTER_AUTH_SECRET is not set: generated once and
 * saved, so sessions survive restarts. If the file can't be written (a
 * read-only filesystem), a per-process secret is used and everyone is signed
 * out on restart.
 */
function localSecret(): { secret: string; persisted: boolean } {
  const file = localSecretFile();
  try {
    const saved = readFileSync(file, "utf8").trim();
    if (saved.length >= 32) return { secret: saved, persisted: true };
  } catch {
    // Not created yet.
  }
  const secret = randomBytes(32).toString("base64url");
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    // `wx`: if another server process created the file first, use theirs.
    writeFileSync(file, secret, { mode: 0o600, flag: "wx" });
    return { secret, persisted: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return { secret: readFileSync(file, "utf8").trim(), persisted: true };
    }
    return { secret, persisted: false };
  }
}

/** `mongodb://host/dbname?opts` → `dbname`. */
export function databaseNameFromUri(uri: string): string | undefined {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri);
  const name = match?.[1] ? decodeURIComponent(match[1]) : "";
  return name || undefined;
}

export function parseEnv(
  source: Record<string, string | undefined>,
  fallbackSecret: string = TEST_SECRET,
): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";

  const emailTransport: Env["emailTransport"] =
    env.SMTP_URL || env.SMTP_HOST
      ? "smtp"
      : env.MAIL_OUTBOX_DIR
        ? "file"
        : "console";

  return {
    ...env,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? fallbackSecret,
    mongoDbName:
      env.MONGODB_DB ?? databaseNameFromUri(env.MONGODB_URI) ?? "plantguard",
    emailTransport,
    isProduction,
    appUrlConfigured: Boolean(source.APP_URL?.trim()),
  };
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const building = process.env.NEXT_PHASE === "phase-production-build";
  const configured = Boolean(process.env.BETTER_AUTH_SECRET?.trim());
  const local = configured || building ? null : localSecret();
  cached = parseEnv(process.env, local?.secret);
  if (building) return cached;

  if (local && !local.persisted) {
    logger.warn(
      `Could not save a generated secret to ${localSecretFile()}; sessions will not survive a restart. Set BETTER_AUTH_SECRET.`,
    );
  }
  if (cached.isProduction) {
    const defaults = ["BETTER_AUTH_SECRET", "APP_URL", "MONGODB_URI"].filter(
      (key) => !process.env[key]?.trim(),
    );
    if (defaults.length > 0) {
      logger.warn(
        `Running with default ${defaults.join(", ")}. Fine for a local install; set them before exposing the app publicly (see .env.example).`,
      );
    }
    if (cached.emailTransport !== "smtp") {
      logger.warn(
        `No SMTP server configured: account emails are written to the ${cached.emailTransport === "file" ? "mail outbox directory" : "server log"} instead of being delivered.`,
      );
    }
  }
  return cached;
}

/** Test hook: forget the parsed environment so the next read re-validates. */
export function resetEnvForTests(): void {
  cached = null;
}

export function googleEnabled(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function githubEnabled(env: Env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}
