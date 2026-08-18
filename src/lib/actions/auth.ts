"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Auth server actions.
 *
 * These return `{ error }` rather than throwing so the forms can render a
 * message inline. Supabase deliberately gives vague errors for bad credentials
 * — we pass that through rather than "improving" it, because a precise error is
 * an account-enumeration oracle.
 */

export interface AuthActionState {
  error?: string;
  notice?: string;
}

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signUpSchema = credentialsSchema.extend({
  displayName: z.string().min(1).max(60).optional(),
});

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    logger.info("auth.signin.failed", { reason: error.message });
    return { error: "That email and password combination did not work." };
  }

  const next = String(formData.get("next") ?? "/dashboard");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback`,
    },
  });

  if (error) {
    logger.info("auth.signup.failed", { reason: error.message });
    return { error: error.message };
  }

  // With email confirmation on, no session is returned until the link is used.
  // Send them somewhere that can resend rather than a dead-end message.
  if (!data.session) {
    redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
  }

  redirect("/dashboard");
}

export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z.email("Enter a valid email address.").safeParse(formData.get("email"));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/reset-password`,
  });

  if (error) logger.info("auth.reset_request.failed", { reason: error.message });

  // Always report success. Telling the caller whether an address exists would
  // turn this form into an account-enumeration oracle.
  return {
    notice:
      "If that address has an account, a reset link is on its way. The link expires in one hour.",
  };
}

export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({
      password: z.string().min(8, "Password must be at least 8 characters."),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, {
      message: "Those passwords do not match.",
      path: ["confirm"],
    })
    .safeParse({
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The recovery link establishes a session; without one there is nothing to
  // update and we must not silently appear to succeed.
  if (!user) {
    return {
      error: "This reset link has expired. Request a new one and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    logger.info("auth.password_update.failed", { reason: error.message });
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function resendVerification(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z.email("Enter a valid email address.").safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` },
  });

  if (error) {
    logger.info("auth.resend.failed", { reason: error.message });
    if (/rate|limit/i.test(error.message)) {
      return { error: "Too many requests. Wait a minute before trying again." };
    }
  }

  return { notice: "Sent. Check your inbox for the confirmation link." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
