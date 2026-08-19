"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Mail } from "lucide-react";
import {
  AuthCard,
  AuthLink,
  AuthSubmit,
  FormMessage,
  authFieldClass,
} from "@/components/auth/auth-shell";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp, type AuthActionState } from "@/lib/actions/auth";

/**
 * One form component for both modes.
 *
 * useActionState keeps the server action as the single source of truth — no
 * client-side auth calls, so the session cookie is set server-side and there is
 * never a window where the browser holds a token the server has not seen.
 */
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const callbackError = searchParams.get("error");

  const action = mode === "sign-in" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(action, {});

  const isSignUp = mode === "sign-up";

  if (state.notice) {
    return (
      <AuthCard
        icon={Mail}
        eyebrow="One more step"
        title="Confirm your email"
        subtitle={state.notice}
        footer={<AuthLink href="/sign-in">Back to sign in</AuthLink>}
      />
    );
  }

  return (
    <AuthCard
      eyebrow={isSignUp ? "New here" : "Back at the bench"}
      title={isSignUp ? "Start building" : "Welcome back"}
      subtitle={
        isSignUp
          ? "2,000 credits to start, and no card. Enough to plan a mechanic, write it, and apply it in Studio."
          : "Your projects, your files and your Studio pairing are exactly where you left them."
      }
      footer={
        isSignUp ? (
          <>
            Already have an account? <AuthLink href="/sign-in">Sign in</AuthLink>
          </>
        ) : (
          <>
            New to Blockwright? <AuthLink href="/sign-up">Create one</AuthLink>
          </>
        )
      }
    >
      <OAuthButtons next={next} />

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />

        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              placeholder="Alex"
              maxLength={60}
              className={authFieldClass}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={authFieldClass}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            {!isSignUp && (
              <AuthLink href="/forgot-password">Forgot?</AuthLink>
            )}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            placeholder={isSignUp ? "At least 8 characters" : "••••••••"}
            className={authFieldClass}
          />
        </div>

        {(state.error || callbackError) && (
          <FormMessage tone="error">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            {state.error ??
              (callbackError === "invalid_code"
                ? "That confirmation link has expired. Try signing in."
                : "Something went wrong with that link.")}
          </FormMessage>
        )}

        <AuthSubmit
          pending={pending}
          pendingLabel={isSignUp ? "Creating" : "Signing in"}
          className="mt-5"
        >
          {isSignUp ? "Create account" : "Sign in"}
        </AuthSubmit>
      </form>
    </AuthCard>
  );
}
