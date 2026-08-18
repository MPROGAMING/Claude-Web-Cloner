import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the one-time code from a confirmation or OAuth redirect for a
 * session cookie. `next` is validated to be a relative path so the callback
 * cannot be used as an open redirect.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // A dead recovery link should land on the reset screen, which explains
    // expiry and offers a new one, rather than a generic sign-in error.
    const target = next === "/reset-password" ? "/reset-password" : "/sign-in?error=invalid_code";
    return NextResponse.redirect(`${origin}${target}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
