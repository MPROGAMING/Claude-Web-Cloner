"use client";

import { useActionState } from "react";
import { AlertCircle, KeyRound, MailCheck } from "lucide-react";
import {
  AuthCard,
  AuthFootnote,
  AuthLink,
  AuthSubmit,
  FormMessage,
  authFieldClass,
} from "@/components/auth/auth-shell";
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
        eyebrow="On its way"
        title="Check your inbox"
        subtitle={state.notice}
        footer={<AuthLink href="/sign-in">Back to sign in</AuthLink>}
      >
        <AuthFootnote>
          Nothing arrived? Check spam, then try again in a minute — repeated requests are rate
          limited.
        </AuthFootnote>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={KeyRound}
      eyebrow="Locked out"
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one. Your projects and files are untouched."
      footer={
        <>
          Remembered it? <AuthLink href="/sign-in">Sign in</AuthLink>
        </>
      }
    >
      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            className={authFieldClass}
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

        <AuthSubmit pending={pending} pendingLabel="Sending" className="mt-5">
          Send reset link
        </AuthSubmit>
      </form>
    </AuthCard>
  );
}
