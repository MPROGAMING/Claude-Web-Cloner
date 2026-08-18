"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-raised)]">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--signal)]/12">
          <Mail className="size-5 text-[var(--signal)]" strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-lg font-semibold">Confirm your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.notice}</p>
        <Link
          href="/sign-in"
          className="mt-6 inline-block text-sm text-[var(--ember)] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-border bg-surface p-7 shadow-[var(--shadow-raised)] sm:p-8">
        <h1 className="text-xl font-semibold">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isSignUp
            ? "2,000 credits to start. No card required."
            : "Sign in to pick up where you left off."}
        </p>

        <form action={formAction} className="mt-7 space-y-4">
          <input type="hidden" name="next" value={next} />

          {isSignUp && (
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Name</Label>
              <Input
                id="displayName"
                name="displayName"
                autoComplete="name"
                placeholder="Alex"
                maxLength={60}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              {!isSignUp && (
                <Link
                  href="/forgot-password"
                  className="rounded text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground focus-ember"
                >
                  Forgot?
                </Link>
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
            />
          </div>

          {(state.error || callbackError) && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/8 px-3 py-2.5 text-[0.8125rem] text-[var(--danger)]"
            >
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              {state.error ??
                (callbackError === "invalid_code"
                  ? "That confirmation link has expired. Try signing in."
                  : "Something went wrong with that link.")}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-2 h-10 w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : "New to Blockwright? "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {isSignUp ? "Sign in" : "Create one"}
        </Link>
      </p>
    </div>
  );
}
