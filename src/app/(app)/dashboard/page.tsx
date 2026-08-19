import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Blocks, Plug2, Zap } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ProjectCard } from "@/components/app/project-card";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { StatusDot } from "@/components/ui/status-dot";
import { getCreditBalance, getProfile, listActivity, listProjects, requireUser } from "@/lib/data/queries";
import { formatCredits } from "@/lib/credits/pricing";
import { TEMPLATES } from "@/lib/templates";
import { DashboardTemplates } from "@/components/app/dashboard-templates";
import { liveProjectIds } from "@/lib/studio/liveness";
import { ActivityTimeline } from "@/components/app/activity-timeline";

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

  const name = profile?.display_name || user.email?.split("@")[0] || "there";
  const credits = balance?.balance ?? 0;

  return (
    <>
      <Topbar
        balance={credits}
        email={user.email ?? ""}
        displayName={profile?.display_name}
      />

      <PageBody>
        <PageHeader
          title={`Welcome back, ${name}`}
          description="Pick up a project, or describe something new and watch it get built."
          actions={<NewProjectDialog />}
        />

        {/* Stat rail */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatTile
            icon={Blocks}
            label="Active projects"
            value={String(projects.length)}
            href="/projects"
          />
          <StatTile
            icon={Zap}
            label="Credits remaining"
            value={formatCredits(credits)}
            href="/credits"
            tone={credits < 500 ? "warning" : undefined}
          />
          <StatTile
            icon={Plug2}
            label="Studio connections"
            value={String(connected.size)}
            hint={connected.size ? "live now" : "none active"}
          />
        </div>

        {/* Projects */}
        <section className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Recent projects</h2>
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

          {projects.length === 0 ? (
            <EmptyState
              icon={Blocks}
              title="No projects yet"
              description="A project holds your conversation, your generated files and your Studio connection. Start with a template or a blank one."
              action={<NewProjectDialog />}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  fileCount={fileCounts.get(project.id) ?? 0}
                  studioConnected={connected.has(project.id)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
          {/* Suggested starts */}
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Start from a template</h2>
              <Link
                href="/templates"
                className="tap-row inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
              >
                All {TEMPLATES.length}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <DashboardTemplates />
          </section>

          {/* Activity */}
          <section>
            <h2 className="mb-4 text-sm font-semibold">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
                Nothing yet. Activity appears here as the AI works.
              </p>
            ) : (
              <ActivityTimeline events={activity} compact />
            )}
          </section>
        </div>
      </PageBody>
    </>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "warning";
}) {
  const body = (
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-foreground/15">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken">
        <Icon
          className={tone === "warning" ? "size-4 text-[var(--warning)]" : "size-4 text-muted-foreground"}
          strokeWidth={1.75}
        />
      </span>
      <div className="min-w-0">
        <p className="label-meta">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5 font-display text-lg font-semibold tabular-nums">
          {value}
          {hint && (
            <span className="inline-flex items-center gap-1 text-[0.6875rem] font-normal text-muted-foreground">
              {hint === "live now" && <StatusDot tone="live" pulse />}
              {hint}
            </span>
          )}
        </p>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="rounded-xl focus-ember">
      {body}
    </Link>
  ) : (
    body
  );
}
