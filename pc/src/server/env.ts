import "server-only";
import { z } from "zod";
import { logger } from "./logger";

/**
 * Server configuration, validated once.
 *
 * Everything the server reads from the environment goes through here, so a
 * missing secret or a malformed URL fails at startup with a message naming the
 * variable — not later as a confusing auth or database error. See
 * `.env.example` for what each variable does.
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

  REQUIRE_EMAIL_VERIFICATION: z.stringbool().default(true),
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
  /** Always set: the configured secret, or the development fallback. */
  BETTER_AUTH_SECRET: string;
  /** Database name: `MONGODB_DB`, else the URI's path, else `plantguard`. */
  mongoDbName: string;
  emailTransport: "smtp" | "file" | "console";
  isProduction: boolean;
};

/** Development-only fallback so a fresh clone runs without any setup. */
const DEV_SECRET = "plantguard-development-secret-do-not-use-in-production";

/** `mongodb://host/dbname?opts` → `dbname`. */
export function databaseNameFromUri(uri: string): string | undefined {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri);
  const name = match?.[1] ? decodeURIComponent(match[1]) : "";
  return name || undefined;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";

  // `next build` runs with NODE_ENV=production but has no business needing
  // runtime secrets; only enforce them when the server actually starts.
  const building = source.NEXT_PHASE === "phase-production-build";

  if (isProduction && !building) {
    const missing = ["BETTER_AUTH_SECRET", "APP_URL", "MONGODB_URI"].filter(
      (key) => !source[key]?.trim(),
    );
    if (missing.length > 0) {
      throw new Error(
        `Missing required production configuration: ${missing.join(", ")}. See .env.example.`,
      );
    }
  }

  const emailTransport: Env["emailTransport"] =
    env.SMTP_URL || env.SMTP_HOST
      ? "smtp"
      : env.MAIL_OUTBOX_DIR
        ? "file"
        : "console";

  return {
    ...env,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
    mongoDbName:
      env.MONGODB_DB ?? databaseNameFromUri(env.MONGODB_URI) ?? "plantguard",
    emailTransport,
    isProduction,
  };
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = parseEnv(process.env);

  if (cached.BETTER_AUTH_SECRET === DEV_SECRET) {
    logger.warn(
      "BETTER_AUTH_SECRET is not set; using the development fallback. Set it before deploying.",
    );
  }
  const building = process.env.NEXT_PHASE === "phase-production-build";
  if (cached.isProduction && !building && cached.emailTransport !== "smtp") {
    logger.warn(
      `No SMTP server configured: account emails are written to the ${cached.emailTransport === "file" ? "mail outbox directory" : "server log"} instead of being delivered.`,
    );
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
