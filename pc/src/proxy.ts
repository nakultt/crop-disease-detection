import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { matchesPrefix, PROTECTED_PREFIXES } from "./app/lib/routes";
import { COOKIE_PREFIX } from "./server/constants";

/**
 * Runs before every page render.
 *
 * 1. Content-Security-Policy with a fresh nonce per request. Next.js reads the
 *    nonce from the request header and stamps it on its own scripts; the
 *    theme boot script in the root layout reads it from `x-nonce`.
 * 2. An optimistic sign-in redirect for app pages. It only checks that a
 *    session cookie exists — the real validation happens in the page, via
 *    `requireSession()`, and again in every API route.
 */

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const https = (process.env.APP_URL ?? "").startsWith("https://");

  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' lets ONNX Runtime compile its WebAssembly; it does
    // not permit eval() of JavaScript. React needs 'unsafe-eval' in dev only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    // Components set inline `style` attributes, which nonces cannot cover.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    // ONNX Runtime's threaded backend spawns workers.
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    matchesPrefix(pathname, PROTECTED_PREFIXES) &&
    !getSessionCookie(request, { cookiePrefix: COOKIE_PREFIX })
  ) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not API routes, build assets, the model, or static files.
      source:
        "/((?!api/|_next/static|_next/image|models/|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|txt|xml)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
