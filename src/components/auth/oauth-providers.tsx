import { Info } from "lucide-react";

/**
 * Social sign-in.
 *
 * Supabase supports these providers, but each has to be enabled with real
 * credentials in the Supabase dashboard first. Rather than render buttons that
 * would fail on click, we render only what is actually configured — and say
 * plainly that the rest are not.
 *
 * `NEXT_PUBLIC_AUTH_PROVIDERS` is a comma-separated allowlist, e.g.
 * `google,github`. Empty means password-only, which is the default.
 */
export const SUPPORTED_OAUTH = ["google", "github", "discord"] as const;
export type OAuthProvider = (typeof SUPPORTED_OAUTH)[number];

export function configuredOAuthProviders(): OAuthProvider[] {
  const raw = process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is OAuthProvider =>
      (SUPPORTED_OAUTH as readonly string[]).includes(value),
    );
}

export function OAuthNotice() {
  const configured = configuredOAuthProviders();
  if (configured.length > 0) return null;

  return (
    <p className="mt-5 flex items-start gap-2 rounded-lg bg-surface-sunken px-3 py-2.5 text-[0.75rem] leading-relaxed text-muted-foreground">
      <Info className="mt-px size-3.5 shrink-0" />
      Social sign-in is not enabled on this deployment. Add providers in Supabase, then list them
      in NEXT_PUBLIC_AUTH_PROVIDERS.
    </p>
  );
}
