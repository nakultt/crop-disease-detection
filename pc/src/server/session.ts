import "server-only";
import { headers } from "next/headers";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { safeReturnPath } from "@/app/lib/routes";
import type { Viewer } from "@/app/lib/viewer";
import { type AuthSession, getAuth } from "./auth";
import { logger } from "./logger";

/**
 * The data access layer for identity.
 *
 * Pages call these instead of reading cookies. The proxy's cookie check is
 * only an optimistic redirect; this is the check that counts, because it
 * validates the session against the database (or the signed cookie cache).
 * `cache` dedupes it across one render, so calling it from a layout and a
 * page costs one lookup.
 */

export const getSession = cache(async (): Promise<AuthSession | null> => {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
});

export async function requireSession(returnTo?: string): Promise<AuthSession> {
  const session = await getSession();
  if (!session) {
    redirect(
      returnTo
        ? `/sign-in?next=${encodeURIComponent(safeReturnPath(returnTo))}`
        : "/sign-in",
    );
  }
  return session;
}

export function isAdmin(session: AuthSession | null): boolean {
  return session?.user.role === "admin";
}

/** Admin pages 404 for everyone else, rather than advertising they exist. */
export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireSession("/admin");
  if (!isAdmin(session)) notFound();
  return session;
}

/**
 * The signed-in user for rendering chrome, or `null`. Never throws: a
 * database outage must not take down public pages along with it.
 */
export async function getViewerSafe(): Promise<Viewer | null> {
  try {
    const session = await getSession();
    return session ? toViewer(session) : null;
  } catch (error) {
    // Next signals redirects and dynamic rendering by throwing; those must
    // propagate, or the framework cannot do its job.
    unstable_rethrow(error);
    logger.error("Session lookup failed", { err: error });
    return null;
  }
}

export function toViewer(session: AuthSession): Viewer {
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    isAdmin: user.role === "admin",
    autoSaveScans: user.autoSaveScans !== false,
    savePhotos: user.savePhotos !== false,
    createdAt: new Date(user.createdAt).toISOString(),
  };
}
