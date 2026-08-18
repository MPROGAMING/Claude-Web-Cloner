"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requirePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Browser Supabase client. Only ever holds the anon key — every table is
 * protected by RLS, so a stolen anon key grants nothing beyond what the
 * signed-in user may already see.
 */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
