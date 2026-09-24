import "server-only";
import { NextResponse } from "next/server";
import { type AuthSession, getAuth } from "./auth";
import { getEnv } from "./env";
import { logger } from "./logger";

/**
 * Plumbing shared by the JSON API route handlers: consistent error bodies,
 * session enforcement, and cross-site request protection.
 */

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function apiError(
  status: number,
  code: string,
  message: string,
  init?: { headers?: Record<string, string> },
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...init?.headers } },
  );
}

export async function sessionFromRequest(
  request: Request,
): Promise<AuthSession | null> {
  const auth = await getAuth();
  return auth.api.getSession({ headers: request.headers });
}

/**
 * Reject state-changing requests that a browser sent on behalf of another
 * site. The session cookie is `SameSite=Lax`, which already stops most
 * cross-site POSTs; this closes the rest (same-site subdomains, older
 * browsers) using Fetch Metadata and the Origin header.
 */
export function crossSiteRejection(request: Request): NextResponse | null {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return apiError(403, "cross_site", "Cross-site requests are not allowed.");
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;

  const env = getEnv();
  const host = request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return apiError(403, "cross_site", "Malformed Origin header.");
  }

  const allowed =
    origin === new URL(env.APP_URL).origin ||
    env.TRUSTED_ORIGINS.includes(origin) ||
    (host !== null && originHost === host);

  return allowed
    ? null
    : apiError(403, "cross_site", "Cross-site requests are not allowed.");
}

type Handler<C> = (
  request: Request,
  context: C,
  session: AuthSession,
) => Promise<Response>;

/**
 * Wrap a handler so it only runs for a signed-in user, rejects cross-site
 * mutations, and turns an unexpected throw into a logged 500 instead of a
 * stack trace in the response.
 */
export function withSession<C>(handler: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        const rejection = crossSiteRejection(request);
        if (rejection) return rejection;
      }

      const session = await sessionFromRequest(request);
      if (!session) {
        return apiError(401, "unauthenticated", "Sign in to continue.");
      }

      return await handler(request, context, session);
    } catch (error) {
      logger.error("Unhandled API error", {
        err: error,
        method: request.method,
        path: new URL(request.url).pathname,
      });
      return apiError(500, "internal", "Something went wrong on our side.");
    }
  };
}
