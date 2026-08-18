"use client";

import { useActionState } from "react";
import { AlertCircle, KeyRound, Loader2, MailCheck } from "lucide-react";
import { AuthCard, AuthLink, FormMessage } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type AuthActionState } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.notice) {
    return (
      <AuthCard
        icon={MailCheck}
        title="Check your inbox"
        subtitle={state.notice}
        footer={<AuthLink href="/sign-in">Back to sign in</AuthLink>}
      >
        <p className="mt-5 rounded-lg bg-surface-sunken px-3 py-2.5 text-[0.75rem] leading-relaxed text-muted-foreground">
          Nothing arrived? Check spam, then try again in a minute — repeated requests are rate
          limited.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={KeyRound}
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <>
          Remembered it? <AuthLink href="/sign-in">Sign in</AuthLink>
        </>
      }
    >
      <form action={formAction} className="mt-7 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            aria-describedby={state.error ? "reset-error" : undefined}
          />
        </div>

        {state.error && (
          <span id="reset-error">
            <FormMessage tone="error">
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              {state.error}
            </FormMessage>
          </span>
        )}

        <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
