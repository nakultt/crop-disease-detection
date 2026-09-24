import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { ObjectId } from "mongodb";
import { after } from "next/server";
import { COOKIE_PREFIX } from "./constants";
import { COLLECTIONS, getDb, getMongo, supportsTransactions } from "./db";
import { sendEmailInBackground } from "./email";
import {
  changeEmailConfirmation,
  passwordResetEmail,
  verificationEmail,
} from "./email-templates";
import { type Env, getEnv, githubEnabled, googleEnabled } from "./env";
import { logger } from "./logger";
import { deleteAllScansForUser } from "./scans";

export const APP_NAME = "PlantGuard";

/**
 * Hand work to Next's `after()` so it outlives the response on every host,
 * serverless included. Outside a request scope (a script calling `auth.api`),
 * `after` throws — the promise is already running, so just let it finish.
 */
function runAfterResponse(task: Promise<unknown>): void {
  try {
    after(() => task);
  } catch {
    void task;
  }
}

async function promoteToAdminIfListed(
  env: Env,
  user: { id: string; email: string },
): Promise<void> {
  if (!env.ADMIN_EMAILS.includes(user.email.toLowerCase())) return;
  if (!ObjectId.isValid(user.id)) return;
  await getDb()
    .collection(COLLECTIONS.user)
    .updateOne({ _id: new ObjectId(user.id) }, { $set: { role: "admin" } });
  logger.info("Granted admin role from ADMIN_EMAILS", { userId: user.id });
}

function createAuth(env: Env, transactions: boolean) {
  const { db, client } = getMongo();

  return betterAuth({
    appName: APP_NAME,
    // Accept any localhost port unless a public APP_URL is configured, so a
    // local install works on whatever port it runs. A configured production
    // deployment is pinned to exactly one origin.
    baseURL:
      env.isProduction && env.appUrlConfigured
        ? env.APP_URL
        : {
            allowedHosts: ["localhost:*", "127.0.0.1:*"],
            fallback: env.APP_URL,
            protocol: "http",
          },
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.TRUSTED_ORIGINS,
    database: mongodbAdapter(
      db,
      transactions ? { client } : { transaction: false },
    ),

    emailAndPassword: {
      enabled: true,
      disableSignUp: env.DISABLE_SIGNUPS,
      requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
      autoSignIn: !env.REQUIRE_EMAIL_VERIFICATION,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmailInBackground(
          passwordResetEmail({
            to: user.email,
            name: user.name,
            url,
            appName: APP_NAME,
          }),
        );
      },
    },

    emailVerification: {
      // With verification off (the local default), sign-up needs no email.
      sendOnSignUp: env.REQUIRE_EMAIL_VERIFICATION,
      // An unverified user who tries to sign in gets a fresh link, rather
      // than being stuck with one that has expired.
      sendOnSignIn: env.REQUIRE_EMAIL_VERIFICATION,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmailInBackground(
          verificationEmail({
            to: user.email,
            name: user.name,
            url,
            appName: APP_NAME,
          }),
        );
      },
      // Admin rights from ADMIN_EMAILS are granted only once the address is
      // proven. Granting at sign-up would let anyone who registers the
      // address first — before its owner — walk in as an administrator.
      afterEmailVerification: async (user) => {
        await promoteToAdminIfListed(env, user);
      },
    },

    socialProviders: {
      ...(googleEnabled(env) && {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        },
      }),
      ...(githubEnabled(env) && {
        github: {
          clientId: env.GITHUB_CLIENT_ID as string,
          clientSecret: env.GITHUB_CLIENT_SECRET as string,
        },
      }),
    },

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
      },
      encryptOAuthTokens: true,
    },

    user: {
      additionalFields: {
        /** Save every analysis to history without asking. */
        autoSaveScans: { type: "boolean", defaultValue: true, required: false },
        /** Keep a compressed copy of the photo with each saved scan. */
        savePhotos: { type: "boolean", defaultValue: true, required: false },
      },
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          await sendEmailInBackground(
            changeEmailConfirmation({
              to: user.email,
              name: user.name,
              newEmail,
              url,
              appName: APP_NAME,
            }),
          );
        },
      },
      deleteUser: { enabled: true },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Saves a database read on most requests; a revoked session can stay
      // readable from the cookie for at most this long.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    rateLimit: {
      enabled: env.isProduction,
      storage: "database",
      window: 60,
      max: 120,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
        "/change-password": { window: 60, max: 5 },
        "/change-email": { window: 60, max: 3 },
        "/delete-user": { window: 60, max: 5 },
      },
    },

    advanced: {
      cookiePrefix: COOKIE_PREFIX,
      backgroundTasks: { handler: runAfterResponse },
    },

    databaseHooks: {
      user: {
        create: {
          // OAuth sign-ups arrive with a verified address, and without
          // required verification nobody is waiting on one, so the admin
          // allow-list can apply immediately; see afterEmailVerification.
          before: async (user) => {
            if (
              (user.emailVerified || !env.REQUIRE_EMAIL_VERIFICATION) &&
              env.ADMIN_EMAILS.includes(user.email.toLowerCase())
            ) {
              return { data: { ...user, role: "admin" } };
            }
          },
        },
        delete: {
          // Fires for self-service deletion and for admin removal alike.
          after: async (user) => {
            const removed = await deleteAllScansForUser(user.id);
            logger.info("Deleted user and their data", {
              userId: user.id,
              scans: removed,
            });
          },
        },
      },
    },

    telemetry: { enabled: false },

    plugins: [
      admin({ defaultRole: "user", adminRoles: ["admin"] }),
      // Must stay last: lets auth calls made from Server Components and
      // Server Functions set cookies through next/headers.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"];
export type AuthUser = AuthSession["user"];

let authPromise: Promise<Auth> | null = null;
/** The Mongo client the cached auth instance was built on. */
let authClient: unknown = null;

/**
 * The Better Auth instance, built on first use.
 *
 * Lazy so that `next build` — which imports route modules to analyse them —
 * never needs a database or production secrets. A failed build is not cached,
 * so a database that was down at first use gets retried.
 */
export function getAuth(): Promise<Auth> {
  // Rebuild if the database client was replaced after a failed connection.
  const { client } = getMongo();
  if (authClient !== client) {
    authPromise = null;
    authClient = client;
  }
  authPromise ??= (async () => {
    const env = getEnv();
    const transactions = await supportsTransactions();
    return createAuth(env, transactions);
  })().catch((error) => {
    authPromise = null;
    throw error;
  });
  return authPromise;
}
