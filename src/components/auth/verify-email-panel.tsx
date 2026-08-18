"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { AuthCard, AuthLink, FormMessage } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
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
      title="Confirm your email"
      subtitle={
        email
          ? `We sent a confirmation link to ${email}. Open it to finish setting up your account.`
          : "We sent you a confirmation link. Open it to finish setting up your account."
      }
      footer={<AuthLink href="/sign-in">Back to sign in</AuthLink>}
    >
      <form action={formAction} className="mt-6 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Resend to</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={email}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>

        {state.error && (
          <FormMessage tone="error">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            {state.error}
          </FormMessage>
        )}
        {state.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

        <Button type="submit" variant="outline" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Resend confirmation
        </Button>
      </form>

      <p className="mt-4 rounded-lg bg-surface-sunken px-3 py-2.5 text-[0.75rem] leading-relaxed text-muted-foreground">
        Links expire after 24 hours. If yours has, resending issues a fresh one.
      </p>
    </AuthCard>
  );
}
