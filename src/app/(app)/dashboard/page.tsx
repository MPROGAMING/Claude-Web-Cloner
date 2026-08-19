import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Blocks, Coins, Plug2, Plus } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { PageBody } from "@/components/app/page-header";
import { ProjectCard } from "@/components/app/project-card";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { StatusDot } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import { BrickText } from "@/components/marketing/brick-text";
import type { Profile } from "@/lib/supabase/types";
import { getCreditBalance, getProfile, listActivity, listProjects, requireUser } from "@/lib/data/queries";
import { MINIMUM_BALANCE_TO_START, formatCredits } from "@/lib/credits/pricing";
import { liveProjectIds } from "@/lib/studio/liveness";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { BenchComposer } from "./bench-composer";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();

  const [profile, balance, projects, activity] = await Promise.all([
    getProfile(),
    getCreditBalance(),
    listProjects({ status: "active", limit: 6 }),
    listActivity({ limit: 8 }),
  ]);

  // File counts and Studio state for the visible projects, in two queries
  // rather than one per card.
  const projectIds = projects.map((p) => p.id);
  const [{ data: files }, { data: connections }] = await Promise.all([
    projectIds.length
      ? supabase.from("project_files").select("project_id").in("project_id", projectIds)
      : Promise.resolve({ data: [] as { project_id: string }[] }),
    projectIds.length
      ? supabase
          .from("studio_connections")
          .select("project_id, status, last_seen_at")
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] as { project_id: string; status: string; last_seen_at: string | null }[] }),
  ]);

  const fileCounts = new Map<string, number>();
  for (const file of files ?? []) {
    fileCounts.set(file.project_id, (fileCounts.get(file.project_id) ?? 0) + 1);
  }

  const connected = liveProjectIds(connections ?? []);

  const greeting = friendlyName(profile);
  const credits = balance?.balance ?? 0;
  /**
   * The one credit state worth saying out loud on the first surface.
   *
   * This row used to read "running low" below 2,000 — which is exactly the
   * signup grant (`0001_init.sql`, `starting_credits := 2000`), so every
   * account was scolded from its first request onward. The product's own
   * warning threshold is 200 (`LOW_BALANCE_BANDS` in `lib/notifications`) and
   * the only hard fact is `MINIMUM_BALANCE_TO_START`: below it a generation is
   * refused. So the bench states the balance and nothing else until a build
   * genuinely cannot start; the badge above and the credits page carry the
   * warning bands.
   */
  const cannotStart = credits < MINIMUM_BALANCE_TO_START;

  return (
    <>
      <Topbar
        balance={credits}
        email={user.email ?? ""}
        displayName={profile?.display_name}
      />

      <PageBody>
        {/*
          The bench.

          The old fold led with three stat tiles, which answer a question
          nobody walks in holding. This leads with the composer, already loaded
          with a real mechanic — the single thing that won every blind
          comparison we ran, and the exact control the nearest competitor
          renders grey-on-grey.
        */}
        <section className="plate relative overflow-hidden rounded-[1.5rem] px-4 py-6 sm:rounded-[1.75rem] sm:px-8 sm:py-8">
          <div
            aria-hidden
            className="stud-plate pointer-events-none absolute inset-0 opacity-[0.36] [--stud-pitch:38px]"
          />
          {/* One light source, from above: the plate catches it at the top and
              falls away at the bottom, which is what stops a large panel from
              reading as a rectangle of paint. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.07),transparent_36%,rgb(0_0_0/0.16))]"
          />

          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Text on a mount, never on bare studs — including the label.

                  A person's name is set in the display face at ordinary case.
                  It used to inherit `.label-meta`, which is uppercase mono, and
                  that turns any name — "Ada Chen" as readily as an account
                  handle — into something that reads like a machine identifier
                  stamped above the headline. */}
              <p className="mount flex max-w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm leading-tight">
                <span aria-hidden className="size-1.5 shrink-0 rounded-[2px] bg-[var(--ember)]" />
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">Welcome back</span>
                  {greeting && (
                    <>
                      <span className="text-muted-foreground">, </span>
                      <span className="font-display font-semibold">{greeting}</span>
                    </>
                  )}
                </span>
              </p>

              <NewProjectDialog
                trigger={
                  <Button variant="outline" size="sm">
                    Start blank
                  </Button>
                }
              />
            </div>

            <h1 className="mt-5 uppercase leading-[0.95]">
              <span className="block text-[clamp(0.9375rem,1.5vw,1.25rem)] font-bold tracking-[0.005em] text-muted-foreground">
                Describe the mechanic.
              </span>
              <span className="mt-2.5 block text-[clamp(1.9rem,5.4vw,3.75rem)]">
                <BrickText>What are we</BrickText> <BrickText tone="ember">building?</BrickText>
              </span>
            </h1>

            <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
              <BenchComposer seed={user.id} />

              {/* The three numbers the old fold led with, kept in full and put
                  where they belong: beside the work, not in front of it. */}
              <div className="mount flex flex-col self-start rounded-2xl p-1.5">
                <p className="label-meta px-3 pb-1 pt-2.5">On the bench</p>
                <Instrument
                  icon={Blocks}
                  label="Active projects"
                  value={String(projects.length)}
                  href="/projects"
                />
                <Instrument
                  icon={Coins}
                  label="Credits remaining"
                  value={formatCredits(credits)}
                  href="/credits"
                  note={cannotStart ? "top up to build" : undefined}
                />
                {/* Signal is the Studio colour in this system, connected or
                    not — it is what keeps the plate from being one hue against
                    itself. The state is still carried by the dot and the word. */}
                <Instrument
                  icon={Plug2}
                  iconClassName="text-[var(--signal)]"
                  label="Studio connections"
                  value={String(connected.size)}
                  href="/settings#studio"
                  live={connected.size > 0}
                  note={connected.size ? "live now" : "none paired"}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Projects — parts, seated on their own plate. */}
        <section className="mt-9">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold">
              {projects.length === 0 ? "Your projects" : "Recent projects"}
            </h2>
            {projects.length > 0 && (
              <Link
                href="/projects"
                className="tap-row inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
              >
                All projects
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>

          {/* A plate is the thing parts are seated *on*. With no parts it is an
              empty lot — a second field of studs wrapped around a small tile —
              so the empty case skips it and lets the Inlet slot be the whole
              surface. What a brand-new account meets points back at the
              composer, which is already loaded and already the loudest control
              on the page, and keeps the blank-project route as the quieter
              second option rather than apologising for an empty list. */}
          {projects.length === 0 ? (
            <EmptyState
              icon={Blocks}
              title="An empty slot, waiting for its first part"
              description="A project keeps the conversation, the Luau it writes and your Studio pairing together. Press Build it above and the first one opens on the mechanic you described."
              className="rounded-[1.25rem] py-10"
              action={
                <NewProjectDialog
                  trigger={
                    <button
                      type="button"
                      className="brick tap-row inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[0.875rem] font-semibold text-foreground [--brick-face:var(--surface-raised)] [--lift:3px] outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)]"
                    >
                      <Plus className="size-4" strokeWidth={2.75} />
                      Or name one yourself
                    </button>
                  }
                />
              }
            />
          ) : (
            <div className="plate relative overflow-hidden rounded-[1.25rem] p-3 sm:p-4">
              <div
                aria-hidden
                className="stud-plate pointer-events-none absolute inset-0 opacity-[0.34] [--stud-pitch:34px]"
              />
              <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project, index) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    index={index}
                    fileCount={fileCounts.get(project.id) ?? 0}
                    studioConnected={connected.has(project.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Activity is a log, not a part — it stays on the page ground. */}
        <section className="mt-9">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            {activity.length > 0 && (
              <Link
                href="/activity"
                className="tap-row inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
              >
                All activity
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
          {activity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
              Nothing yet. Activity appears here as the AI works.
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-5">
              <ActivityTimeline events={activity} compact />
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}

/**
 * What to call the person, greeting them.
 *
 * `getProfile` returns `display_name` (what they typed into Settings) and
 * `roblox_username` (the name they build under) — both real names, either of
 * which is a friendly thing to be called. The email local part is not: it is a
 * routing address, and the old fallback rendered it verbatim, which is how a
 * greeting ended up looking like an account identifier. So when neither name
 * exists we greet without one rather than inventing or exposing one.
 */
function friendlyName(profile: Profile | null): string | null {
  for (const candidate of [profile?.display_name, profile?.roblox_username]) {
    const name = candidate?.trim();
    if (name) return name;
  }
  return null;
}

/**
 * One reading on the bench panel. A row rather than a tile: the numbers are
 * still first-class, they are just no longer the first thing anyone is asked
 * to look at.
 */
function Instrument({
  icon: Icon,
  iconClassName,
  label,
  value,
  note,
  href,
  live,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconClassName?: string;
  label: string;
  value: string;
  note?: string;
  href: string;
  live?: boolean;
}) {
  return (
    <Link
      href={href}
      className="tap-row flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-sunken)] focus-ember"
    >
      <Icon
        className={cn("size-4 shrink-0 text-muted-foreground", iconClassName)}
        strokeWidth={1.75}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-medium">{label}</span>
        {note && (
          <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground">
            {live && <StatusDot tone="live" pulse />}
            {note}
          </span>
        )}
      </span>
      <span className="font-display text-lg font-semibold tabular-nums">{value}</span>
    </Link>
  );
}
