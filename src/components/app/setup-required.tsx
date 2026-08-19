import { Logo } from "@/components/brand/logo";

/**
 * Shown instead of a crash when the deployment has no Supabase credentials.
 * A blank 500 during first-run setup is the worst possible first impression —
 * so it gets the same material as the rest of the app, and the instructions
 * sit on a mounted panel rather than on the bare lattice.
 */
export function SetupRequired() {
  return (
    <main className="plate relative flex min-h-dvh items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="stud-plate pointer-events-none absolute inset-0 opacity-[0.36] [--stud-pitch:38px]"
      />
      <div className="mount relative w-full max-w-lg rounded-2xl p-8">
        <Logo className="mb-6" />
        <h1 className="text-lg font-semibold">Finish the setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Blockwright needs a Supabase project before the app can run. Copy{" "}
          <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-xs">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-xs">
            .env.local
          </code>
          , fill in the values, then restart the dev server.
        </p>

        <ol className="mt-6 space-y-3 text-sm">
          {[
            "Create a project at supabase.com",
            "Run supabase/migrations/0001_init.sql in the SQL editor",
            "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY",
            "Add at least one AI provider key",
          ].map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-[var(--ember)] font-mono text-[0.6875rem] font-semibold text-[var(--ember-ink)]">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
