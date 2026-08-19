"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, ShieldCheck } from "lucide-react";
import {
  AuthCard,
  AuthLink,
  AuthSubmit,
  FormMessage,
  authFieldClass,
} from "@/components/auth/auth-shell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
        eyebrow="Dead link"
        title="This link has expired"
        subtitle="Password reset links are valid for one hour and can only be used once."
        footer={<AuthLink href="/sign-in">Back to sign in</AuthLink>}
      >
        {/* An anchor, not a Button with `render` — Base UI's Button asserts
            native button semantics and a forced anchor breaks Enter/Space. */}
        <Link
          href="/forgot-password"
          className="brick tap-row mb-1.5 mt-6 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 font-display text-[1rem] font-extrabold uppercase tracking-[0.045em] text-[var(--ember-ink)] no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)]"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={ShieldCheck}
      eyebrow="Nearly done"
      title="Choose a new password"
      subtitle="You'll be signed in as soon as it's saved."
    >
      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-2">
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
            className={authFieldClass}
          />
        </div>

        {/* Pressed into the tray: a semantic colour needs the sunken tone
            behind it to clear 4.5:1 on this plate, and a checklist reads as a
            gauge rather than as copy. */}
        <ul className="space-y-1.5 rounded-lg bg-surface-sunken px-3 py-2.5 shadow-[inset_0_1px_3px_0_rgb(0_0_0/0.42),inset_0_-1px_0_0_rgb(255_255_255/0.05)]">
          {RULES.map((rule) => {
            const met = rule.test(password);
            return (
              <li
                key={rule.id}
                className={cn(
                  "flex items-center gap-2 text-[0.75rem] transition-colors",
                  met ? "text-[var(--success)]" : "text-muted-foreground",
                )}
              >
                <Check
                  className={cn("size-3 transition-opacity", met ? "opacity-100" : "opacity-40")}
                  strokeWidth={2.5}
                />
                {rule.label}
              </li>
            );
          })}
        </ul>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={authFieldClass}
          />
        </div>

        {state.error && (
          <FormMessage tone="error">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            {state.error}
          </FormMessage>
        )}

        <AuthSubmit pending={pending} pendingLabel="Saving" className="mt-5">
          Save password
        </AuthSubmit>
      </form>
    </AuthCard>
  );
}
