import type { Metadata } from "next";
import { Topbar } from "@/components/app/topbar";
import { PageBody } from "@/components/app/page-header";
import { SettingsForm } from "@/components/app/settings-form";
import { BrickText } from "@/components/marketing/brick-text";
import { getCreditBalance, getProfile, requireUser } from "@/lib/data/queries";
import { listClientModels } from "@/lib/ai/providers";
import { DEFAULT_MODEL_ID } from "@/lib/ai/registry";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Stagger classes rather than an inline `--i`: utilities only, per house rules. */
const LAND_DELAY = ["[--i:0]", "[--i:1]", "[--i:2]"] as const;

export const metadata: Metadata = { title: "Settings" };

/**
 * The bench.
 *
 * Two halves that are genuinely different in kind: the things you change (a
 * name, a default model) and the one thing you install (the Studio plugin).
 * The install is a physical, three-step job that happens on a different
 * machine, so it gets its own plate and its own numbered parts rather than
 * being a paragraph of instructions in a settings card.
 *
 * Every path and folder below is the plugin's real install location, taken
 * from `roblox-plugin/README.md` — not a plausible-looking one.
 */
const STEPS = [
  {
    title: "Take the part",
    body: "Download the plugin script from the repository.",
    code: "roblox-plugin/Blockwright.server.lua",
  },
  {
    title: "Snap it in",
    body: "Drop it into your local Roblox plugins folder, then restart Studio. A Blockwright button appears in the Plugins tab.",
    paths: [
      ["Windows", "%LOCALAPPDATA%\\Roblox\\Plugins"],
      ["macOS", "~/Documents/Roblox/Plugins"],
    ] as const,
  },
  {
    title: "Pair the place",
    body: "Open a project here, click Connect Roblox Studio, and paste the six-character code into the plugin.",
  },
] as const;

export default async function SettingsPage() {
  const { user } = await requireUser();
  const [profile, balance, catalog] = await Promise.all([
    getProfile(),
    getCreditBalance(),
    listClientModels(),
  ]);
  const models = catalog.models;

  const account: { label: string; value: string; caps?: boolean }[] = [
    { label: "Email", value: user.email ?? "—" },
    { label: "Plan", value: profile?.plan ?? "free", caps: true },
    { label: "Member since", value: profile ? formatDateTime(profile.created_at) : "—" },
  ];

  return (
    <>
      <Topbar
        balance={balance?.balance ?? 0}
        email={user.email ?? ""}
        displayName={profile?.display_name}
      />

      <PageBody className="max-w-4xl">
        <section className="plate relative overflow-hidden rounded-[1.5rem] px-5 py-6 sm:rounded-[1.75rem] sm:px-8 sm:py-7">
          <div
            aria-hidden
            className="stud-plate pointer-events-none absolute inset-0 opacity-[0.38] [--stud-pitch:38px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.075),transparent_34%,rgb(0_0_0/0.16))]"
          />

          <div className="relative">
            <p className="mount label-meta inline-flex items-center gap-2.5 rounded-lg px-3 py-1.5">
              <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--ember)]" />
              Your bench
            </p>

            <h1 className="mt-4 font-display text-[clamp(2.25rem,7vw,3.5rem)] font-semibold uppercase leading-[0.9]">
              <BrickText>Settings</BrickText>
            </h1>

            <div className="mount mt-6 rounded-2xl px-4 py-4 sm:px-6 sm:py-5">
              <p className="max-w-[46rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
                Your profile, the model new projects start on, and the one thing you install on your
                own machine.
              </p>

              <dl className="mt-4 grid gap-4 border-t border-hairline pt-4 sm:grid-cols-3">
                {account.map((row) => (
                  <div key={row.label} className="min-w-0">
                    <dt className="label-meta">{row.label}</dt>
                    <dd
                      className={cn("mt-1 truncate text-[0.875rem]", row.caps && "capitalize")}
                      title={row.value}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <div className="mt-8">
          <SettingsForm
            email={user.email ?? ""}
            displayName={profile?.display_name ?? ""}
            robloxUsername={profile?.roblox_username ?? ""}
            defaultModelId={profile?.default_model_id ?? DEFAULT_MODEL_ID}
            models={models}
          />
        </div>

        {/* The install. Its own plate, because it is a physical job on another
            machine rather than a preference. */}
        <section className="plate relative mt-8 overflow-hidden rounded-[1.5rem] px-5 py-6 sm:rounded-[1.75rem] sm:px-8 sm:py-7">
          <div
            aria-hidden
            className="stud-plate pointer-events-none absolute inset-0 opacity-[0.38] [--stud-pitch:38px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.075),transparent_34%,rgb(0_0_0/0.16))]"
          />

          <div className="relative">
            <p className="mount label-meta inline-flex items-center gap-2.5 rounded-lg px-3 py-1.5">
              <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--signal)]" />
              Roblox Studio plugin
            </p>

            <h2 className="mt-4 font-display text-[clamp(1.75rem,5.5vw,2.75rem)] font-semibold uppercase leading-[0.92]">
              <BrickText>Three steps,</BrickText> <BrickText tone="ember">once.</BrickText>
            </h2>

            <ol className="mt-6 grid gap-3 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className={cn("mount land flex flex-col rounded-xl p-4", LAND_DELAY[index])}
                >
                  <span
                    aria-hidden
                    className="brick flex size-8 items-center justify-center rounded-lg font-display text-[0.9375rem] font-bold text-[var(--plate-deep)] [--brick-face:var(--plate-signal)] [--lift:3px]"
                  >
                    {index + 1}
                  </span>
                  <p className="mt-4 text-[0.9375rem] font-semibold">{step.title}</p>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>

                  {"code" in step && step.code && (
                    <code className="mt-3 block overflow-x-auto whitespace-nowrap rounded-lg bg-surface-sunken px-2.5 py-1.5 font-mono text-[0.6875rem] leading-relaxed">
                      {step.code}
                    </code>
                  )}

                  {"paths" in step && step.paths && (
                    <dl className="mt-3 space-y-1.5">
                      {step.paths.map(([os, path]) => (
                        <div key={os}>
                          <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                            {os}
                          </dt>
                          <dd className="overflow-x-auto whitespace-nowrap rounded-lg bg-surface-sunken px-2.5 py-1.5 font-mono text-[0.6875rem]">
                            {path}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ol>

            <p className="mount mt-4 rounded-xl px-4 py-3.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
              Pairing happens per project, from the Studio panel inside a workspace — install the
              plugin once and it remembers every project it has been paired with. The plugin only
              ever runs an allowlisted verb; it is never sent code to execute, and a project&rsquo;s
              token can be revoked from its Studio panel at any time.
            </p>
          </div>
        </section>
      </PageBody>
    </>
  );
}
