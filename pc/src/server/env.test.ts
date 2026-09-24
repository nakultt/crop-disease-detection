import { describe, expect, it } from "vitest";
import { databaseNameFromUri, parseEnv } from "./env";

describe("parseEnv", () => {
  it("runs a fresh clone with no configuration at all", () => {
    const env = parseEnv({ NODE_ENV: "development" });
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.mongoDbName).toBe("plantguard");
    expect(env.emailTransport).toBe("console");
    expect(env.REQUIRE_EMAIL_VERIFICATION).toBe(true);
    expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("refuses to start in production without its secrets", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("does not demand runtime secrets during `next build`", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }),
    ).not.toThrow();
  });

  it("accepts a complete production configuration", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      APP_URL: "https://plantguard.example/",
      BETTER_AUTH_SECRET: "x".repeat(40),
      MONGODB_URI:
        "mongodb+srv://user:pw@cluster.example/pg-prod?retryWrites=true",
      SMTP_URL: "smtp://user:pw@smtp.example:587",
    });
    expect(env.APP_URL).toBe("https://plantguard.example");
    expect(env.mongoDbName).toBe("pg-prod");
    expect(env.emailTransport).toBe("smtp");
    expect(env.isProduction).toBe(true);
  });

  it("rejects a short secret and a non-Mongo URI", () => {
    expect(() => parseEnv({ BETTER_AUTH_SECRET: "short" })).toThrow(
      /at least 32/,
    );
    expect(() => parseEnv({ MONGODB_URI: "postgres://x" })).toThrow(/mongodb/);
  });

  it("parses lists and booleans", () => {
    const env = parseEnv({
      ADMIN_EMAILS: " Admin@Example.com , ops@example.com,",
      REQUIRE_EMAIL_VERIFICATION: "false",
      DISABLE_SIGNUPS: "yes",
      MAIL_OUTBOX_DIR: ".mail",
    });
    expect(env.ADMIN_EMAILS).toEqual(["admin@example.com", "ops@example.com"]);
    expect(env.REQUIRE_EMAIL_VERIFICATION).toBe(false);
    expect(env.DISABLE_SIGNUPS).toBe(true);
    expect(env.emailTransport).toBe("file");
  });
});

describe("databaseNameFromUri", () => {
  it("reads the path segment", () => {
    expect(databaseNameFromUri("mongodb://localhost:27017/farm")).toBe("farm");
    expect(databaseNameFromUri("mongodb+srv://a:b@c.example/farm?x=1")).toBe(
      "farm",
    );
    expect(databaseNameFromUri("mongodb://localhost:27017/")).toBeUndefined();
    expect(databaseNameFromUri("mongodb://localhost:27017")).toBeUndefined();
  });
});
