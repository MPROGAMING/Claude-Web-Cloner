import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requirePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Reads/writes the auth cookies so sessions refresh correctly.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled in proxy.ts instead.
        }
      },
    },
  });
}

/** Returns the signed-in user, or null. Never throws for anonymous visitors. */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
