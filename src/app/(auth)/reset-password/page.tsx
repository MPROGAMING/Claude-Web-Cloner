import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * The recovery link goes through /auth/callback, which exchanges the code for
 * a session before redirecting here. So "is there a session?" is exactly the
 * question of whether the link was valid and unexpired.
 */
export default async function ResetPasswordPage() {
  let hasSession = false;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = Boolean(user);
  }

  return <ResetPasswordForm hasSession={hasSession} />;
}
