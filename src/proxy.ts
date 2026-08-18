import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Next.js 16 renamed `middleware` to `proxy` (Node runtime, not edge).
 *
 * Two jobs:
 *   1. refresh the Supabase session cookie on every request, so a Server
 *      Component never sees a stale token
 *   2. gate the authenticated area — the redirect here is UX, not security;
 *      RLS and per-route auth checks are what actually protect data
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects",
  "/templates",
  "/activity",
  "/credits",
  "/settings",
];

/** Redirect signed-in users away from these. `/reset-password` is deliberately
 *  absent: a recovery link creates a session, and bouncing it to the dashboard
 *  would make the reset flow impossible to complete. */
const AUTH_ROUTES = ["/sign-in", "/sign-up", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Without Supabase configured the app still renders marketing pages.
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates against the auth server — getSession() would trust
  // whatever cookie the browser sent.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimisation, and the Studio
     * bridge routes — the plugin authenticates with its own token and has no
     * cookies to refresh.
     */
    "/((?!_next/static|_next/image|api/studio|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
