import type { Metadata } from "next";
import { Blocks } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ProjectCard } from "@/components/app/project-card";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCreditBalance, getProfile, listProjects, requireUser } from "@/lib/data/queries";
import { liveProjectIds } from "@/lib/studio/liveness";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { supabase, user } = await requireUser();

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

  const grid = (list: typeof projects) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
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
        <PageHeader
          title="Projects"
          description="Every project keeps its own files, conversation history and Studio pairing."
          actions={<NewProjectDialog />}
        />

        <Tabs defaultValue="active" className="mt-8">
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archived.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {active.length === 0 ? (
              <EmptyState
                icon={Blocks}
                title="No active projects"
                description="Create one and describe what you want to build. The AI handles the file structure."
                action={<NewProjectDialog />}
              />
            ) : (
              grid(active)
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-6">
            {archived.length === 0 ? (
              <EmptyState
                icon={Blocks}
                title="Nothing archived"
                description="Archiving hides a project from your active list without deleting anything."
              />
            ) : (
              grid(archived)
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
