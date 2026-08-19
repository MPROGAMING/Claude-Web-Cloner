import type { Metadata } from "next";
import { Blocks, Plus } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { PageBody } from "@/components/app/page-header";
import { ProjectCard } from "@/components/app/project-card";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { BrickText } from "@/components/marketing/brick-text";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCreditBalance, getProfile, listProjects, requireUser } from "@/lib/data/queries";
import { liveProjectIds } from "@/lib/studio/liveness";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const { supabase, user } = await requireUser();
  // `?start=1` arrives from the landing hero: the visitor typed an idea, signed
  // in, and should land with the project dialog already open on it.
  const { start } = await searchParams;

  const [profile, balance, projects] = await Promise.all([
    getProfile(),
    getCreditBalance(),
    listProjects(),
  ]);

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
      : Promise.resolve({
          data: [] as { project_id: string; status: string; last_seen_at: string | null }[],
        }),
  ]);

  const fileCounts = new Map<string, number>();
  for (const file of files ?? []) {
    fileCounts.set(file.project_id, (fileCounts.get(file.project_id) ?? 0) + 1);
  }
  const connected = liveProjectIds(connections ?? []);

  const active = projects.filter((p) => p.status === "active");
  const archived = projects.filter((p) => p.status === "archived");

  /**
   * Parts, seated on a plate. The plate is the surface; the cards occlude it.
   *
   * Only ever wrapped around actual parts: a plate with nothing on it is a
   * second field of studs around a small tile, which is the empty-lot reading
   * an empty state can least afford.
   */
  const plate = (children: React.ReactNode) => (
    <div className="plate relative overflow-hidden rounded-[1.25rem] p-3 sm:p-4">
      <div
        aria-hidden
        className="stud-plate pointer-events-none absolute inset-0 opacity-[0.34] [--stud-pitch:34px]"
      />
      <div className="relative">{children}</div>
    </div>
  );

  const grid = (list: typeof projects) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((project, index) => (
        <ProjectCard
          key={project.id}
          project={project}
          index={index}
          fileCount={fileCounts.get(project.id) ?? 0}
          studioConnected={connected.has(project.id)}
        />
      ))}
    </div>
  );

  return (
    <>
      <Topbar balance={balance?.balance ?? 0} email={user.email ?? ""} displayName={profile?.display_name} />

      <PageBody>
        <section className="plate relative overflow-hidden rounded-[1.5rem] px-4 py-6 sm:rounded-[1.75rem] sm:px-8 sm:py-7">
          <div
            aria-hidden
            className="stud-plate pointer-events-none absolute inset-0 opacity-[0.36] [--stud-pitch:38px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.07),transparent_36%,rgb(0_0_0/0.16))]"
          />

          <div className="relative">
            <p className="mount label-meta inline-flex items-center gap-2.5 rounded-lg px-3 py-2">
              <span aria-hidden className="size-1.5 shrink-0 rounded-[2px] bg-[var(--ember)]" />
              {active.length} active · {archived.length} archived
            </p>

            <h1 className="mt-4 text-[clamp(1.9rem,5vw,3.25rem)] uppercase leading-[0.95]">
              <BrickText>Projects</BrickText>
            </h1>

            {/* The action sits *after* the title at every width. Wrapped above
                it, a narrow viewport reads the CTA before it knows the page. */}
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              {/* Running text sits on an opaque tile, never on the lattice. */}
              <p className="mount max-w-2xl rounded-xl px-4 py-3 text-[0.875rem] leading-relaxed text-muted-foreground">
                Every project keeps its own files, conversation history and Studio pairing.
                Open one to pick up exactly where the agent left it.
              </p>

              <NewProjectDialog
                defaultOpen={start === "1"}
                adoptIntent
                trigger={
                  <button
                    type="button"
                    className="brick tap-row inline-flex shrink-0 items-center gap-2 self-start rounded-xl px-5 py-3 font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.04em] text-[var(--ember-ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)] sm:self-auto"
                  >
                    <Plus className="size-4" strokeWidth={2.75} />
                    New project
                  </button>
                }
              />
            </div>
          </div>
        </section>

        <Tabs defaultValue="active" className="mt-8">
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archived.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-5">
            {/* The tab label is a control, not a heading, so the outline would
                otherwise jump straight from the page title to a card title. */}
            <h2 className="sr-only">Active projects</h2>
            {active.length === 0 ? (
              <EmptyState
                icon={Blocks}
                className="rounded-[1.25rem] py-10"
                title="Nothing on the plate yet"
                description="Name a project and describe the mechanic you want. Blockwright plans it, writes the Luau into the right services, and hands you the diff before anything reaches your place."
                action={<NewProjectDialog />}
              />
            ) : (
              plate(grid(active))
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-5">
            <h2 className="sr-only">Archived projects</h2>
            {archived.length === 0 ? (
              <EmptyState
                icon={Blocks}
                className="rounded-[1.25rem] py-10"
                title="Nothing archived"
                description="Archiving hides a project from your active list without deleting anything."
              />
            ) : (
              plate(grid(archived))
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
