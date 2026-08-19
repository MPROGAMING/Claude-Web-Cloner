"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, MailCheck } from "lucide-react";
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
import { resendVerification, type AuthActionState } from "@/lib/actions/auth";

export function VerifyEmailPanel() {
  const email = useSearchParams().get("email") ?? "";
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    resendVerification,
    {},
  );

  return (
    <AuthCard
      icon={MailCheck}
      eyebrow="Almost in"
      title="Confirm your email"
      subtitle={
        email
          ? `We sent a confirmation link to ${email}. Open it and your workshop is ready.`
          : "We sent you a confirmation link. Open it and your workshop is ready."
      }
      footer={<AuthLink href="/sign-in">Back to sign in</AuthLink>}
    >
      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Resend to</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={email}
            autoComplete="email"
            placeholder="you@example.com"
            className={authFieldClass}
          />
        </div>

        {state.error && (
          <FormMessage tone="error">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            {state.error}
          </FormMessage>
        )}
        {state.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

        <AuthSubmit pending={pending} pendingLabel="Sending" className="mt-5">
          Resend confirmation
        </AuthSubmit>
      </form>

      <AuthFootnote>
        Links expire after 24 hours. If yours has, resending issues a fresh one.
      </AuthFootnote>
    </AuthCard>
  );
}
