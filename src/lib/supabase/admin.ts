import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role client. Bypasses RLS.
 *
 * Used by exactly one subsystem: the Roblox Studio bridge, where a polling
 * plugin authenticates with a hashed token and there is no user session to
 * scope queries with. Every caller does its own authorization first.
 *
 * Everything else — including credits and AI request logging — runs on the
 * user-scoped client, so the app is fully functional without this key.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new AppError(
      "provider_unconfigured",
      "The Roblox Studio bridge is not configured on this deployment.",
      503,
    );
  }

  return createClient<Database>(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when the Studio bridge can operate. */
export function isStudioBridgeConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
