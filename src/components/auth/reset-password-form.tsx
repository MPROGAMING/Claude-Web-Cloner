"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Loader2, ShieldCheck } from "lucide-react";
import { AuthCard, AuthLink, FormMessage } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type AuthActionState } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

/** Live requirement feedback — cheaper than submitting to find out. */
const RULES = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "mix", label: "Letters and numbers", test: (v: string) => /[a-z]/i.test(v) && /\d/.test(v) },
];

export function ResetPasswordForm({ hasSession }: { hasSession: boolean }) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    updatePassword,
    {},
  );
  const [password, setPassword] = useState("");

  if (!hasSession) {
    return (
      <AuthCard
        icon={AlertCircle}
        title="This link has expired"
        subtitle="Password reset links are valid for one hour and can only be used once."
        footer={<AuthLink href="/sign-in">Back to sign in</AuthLink>}
      >
        <Button
          size="lg"
          className="mt-6 h-10 w-full"
          render={<a href="/forgot-password">Request a new link</a>}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={ShieldCheck}
      title="Choose a new password"
      subtitle="You'll be signed in as soon as it's saved."
    >
      <form action={formAction} className="mt-7 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <ul className="space-y-1">
          {RULES.map((rule) => {
            const met = rule.test(password);
            return (
              <li
                key={rule.id}
                className={cn(
                  "flex items-center gap-1.5 text-[0.75rem] transition-colors",
                  met ? "text-[var(--success)]" : "text-muted-foreground",
                )}
              >
                <Check
                  className={cn("size-3 transition-opacity", met ? "opacity-100" : "opacity-35")}
                  strokeWidth={2.5}
                />
                {rule.label}
              </li>
            );
          })}
        </ul>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {state.error && (
          <FormMessage tone="error">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            {state.error}
          </FormMessage>
        )}

        <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save password
        </Button>
      </form>
    </AuthCard>
  );
}
