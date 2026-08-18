/**
 * Central environment access.
 *
 * Server secrets are read lazily so that importing this module from a shared
 * file never crashes a client bundle, and so that a missing optional provider
 * key degrades that one provider instead of taking down the app.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

/** Public config — safe to reference from client components. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export function requirePublicEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", publicEnv.supabaseUrl),
    supabaseAnonKey: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      publicEnv.supabaseAnonKey,
    ),
  };
}

/** Server-only secrets. Never import the results of this into a client component. */
export const serverEnv = {
  get anthropicApiKey() {
    return process.env.ANTHROPIC_API_KEY;
  },
  get openaiApiKey() {
    return process.env.OPENAI_API_KEY;
  },
  get googleApiKey() {
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  },
  get openrouterApiKey() {
    return process.env.OPENROUTER_API_KEY;
  },
};

export type ProviderId = "anthropic" | "openai" | "google" | "openrouter";

/** Which providers actually have credentials in this deployment. */
export function configuredProviders(): Record<ProviderId, boolean> {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
  };
}
