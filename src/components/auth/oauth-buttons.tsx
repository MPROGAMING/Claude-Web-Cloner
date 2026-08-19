"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  configuredOAuthProviders,
  type OAuthProvider,
} from "@/components/auth/oauth-providers";
import { createClient } from "@/lib/supabase/client";

/**
 * Social sign-in, rendered only for providers this deployment has actually
 * configured (`NEXT_PUBLIC_AUTH_PROVIDERS`). A button that would fail on click
 * is worse than no button, so an unconfigured deployment renders nothing here
 * and the password form stands alone.
 *
 * No borrowed brand marks: a provider gets its name, not a logo we would have
 * to redraw. The redirect goes through `/auth/callback`, which is the same
 * one-time-code exchange the email confirmation link uses.
 */
const LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

export function OAuthButtons({ next }: { next: string }) {
  const providers = configuredOAuthProviders();
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  if (providers.length === 0) return null;

  const start = async (provider: OAuthProvider) => {
    setPending(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser has already left; only a failure lands back here.
    if (error) setPending(null);
  };

  return (
    <div className="mt-6">
      <ul className="flex flex-col gap-2">
        {providers.map((provider) => (
          <li key={provider}>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void start(provider)}
              className="brick tap-row inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[0.875rem] font-semibold text-foreground [--brick-face:var(--plate-raised)] [--lift:4px] outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)] disabled:opacity-70"
            >
              {pending === provider && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Continue with {LABELS[provider]}
            </button>
          </li>
        ))}
      </ul>

      <p className="label-meta mt-5 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-[var(--hairline)]" />
        or with email
        <span aria-hidden className="h-px flex-1 bg-[var(--hairline)]" />
      </p>
    </div>
  );
}
