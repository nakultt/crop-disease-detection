"use client";

import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "@/server/auth";
import type { TranslationKey } from "./i18n/types";

/**
 * The browser-side Better Auth client. It talks to /api/auth on the current
 * origin, so it needs no base URL.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>(), adminClient()],
});

const ERROR_KEYS: Record<string, TranslationKey> = {
  INVALID_EMAIL_OR_PASSWORD: "authError.invalidCredentials",
  INVALID_PASSWORD: "authError.invalidPassword",
  EMAIL_NOT_VERIFIED: "authError.emailNotVerified",
  USER_ALREADY_EXISTS: "authError.userExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "authError.userExists",
  PASSWORD_TOO_SHORT: "authError.passwordTooShort",
  PASSWORD_TOO_LONG: "authError.passwordTooLong",
  INVALID_EMAIL: "authError.invalidEmail",
  INVALID_TOKEN: "authError.invalidToken",
  TOKEN_EXPIRED: "authError.invalidToken",
  SESSION_EXPIRED: "authError.sessionExpired",
  SESSION_NOT_FRESH: "authError.sessionExpired",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "authError.noPassword",
  BANNED_USER: "authError.banned",
  EMAIL_ALREADY_VERIFIED: "authError.alreadyVerified",
};

/** Turn a Better Auth error into a translated, human sentence. */
export function authErrorKey(
  error: { code?: string; status?: number } | null | undefined,
): TranslationKey {
  if (!error) return "authError.generic";
  if (error.code && ERROR_KEYS[error.code]) return ERROR_KEYS[error.code];
  if (error.status === 429) return "authError.rateLimited";
  if (error.status === 403 && error.code === undefined) {
    return "authError.forbidden";
  }
  return "authError.generic";
}
