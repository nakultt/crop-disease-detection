import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production build.
 *
 *   npm run build && npm run test:e2e
 *
 * Needs a MongoDB (MONGODB_URI, default local). Account emails go to a file
 * outbox, which the tests read to follow verification links. Set
 * E2E_BASE_URL to test an already-running deployment instead.
 */

const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// Keep in sync with e2e/helpers.ts.
const OUTBOX = path.resolve(__dirname, ".e2e-outbox");

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Locally, use the installed Chrome rather than downloading a browser.
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /public\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node scripts/start-standalone.mjs",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          PORT: String(PORT),
          HOSTNAME: "127.0.0.1",
          APP_URL: baseURL,
          BETTER_AUTH_SECRET:
            process.env.BETTER_AUTH_SECRET ??
            "e2e-only-secret-not-for-production-use-0123456789",
          MONGODB_URI:
            process.env.MONGODB_URI ??
            "mongodb://127.0.0.1:27017/plantguard_e2e",
          MAIL_OUTBOX_DIR: OUTBOX,
          REQUIRE_EMAIL_VERIFICATION: "true",
          LOG_LEVEL: "warn",
        },
      },
});
