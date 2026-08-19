import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/workspace";
import {
  getConversationMessages,
  getCreditBalance,
  getProfile,
  getProject,
  listConversations,
  listProjectFiles,
  requireUser,
} from "@/lib/data/queries";
import { listClientModels } from "@/lib/ai/providers";
import { getConnection } from "@/lib/studio/service";
import { touchProject } from "@/lib/actions/projects";
import type { BlockwrightUIMessage } from "@/lib/ai/types";
import { createClient } from "@/lib/supabase/server";
import { blueprintSchema, type BlueprintIssue } from "@/lib/blueprint/schema";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project?.name ?? "Project" };
}

async function createConversationFor(projectId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .insert({ project_id: projectId, owner_id: userId, title: "New conversation" })
    .select("id")
    .single();
  return data?.id;
}

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const project = await getProject(id);
  if (!project) notFound();

  const [profile, balance, files, conversations, connection, catalog, blueprintRow] =
    await Promise.all([
      getProfile(),
      getCreditBalance(),
      listProjectFiles(project.id),
      listConversations(project.id),
      getConnection(supabase, project.id, user.id),
      listClientModels(),
      // The most recent plan, approved or still in review, so reopening the
      // dialog resumes where the creator left off instead of starting over.
      supabase
        .from("game_blueprints")
        .select("id, blueprint, issues, status")
        .eq("project_id", project.id)
        .in("status", ["draft", "approved"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const parsedBlueprint = blueprintRow.data?.blueprint
    ? blueprintSchema.safeParse(blueprintRow.data.blueprint)
    : null;

  const approvedBlueprint =
    blueprintRow.data && parsedBlueprint?.success
      ? {
          id: blueprintRow.data.id,
          blueprint: parsedBlueprint.data,
          issues: (blueprintRow.data.issues ?? []) as BlueprintIssue[],
          approved: blueprintRow.data.status === "approved",
        }
      : undefined;

  // Every project has a conversation; create one if an older row is missing it.
  const conversationId = conversations[0]?.id ?? (await createConversationFor(project.id, user.id));
  if (!conversationId) notFound();

  const rows = await getConversationMessages(conversationId);
  const initialMessages: BlockwrightUIMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    parts: row.parts as BlockwrightUIMessage["parts"],
    metadata: { modelId: row.model_id ?? undefined, createdAt: row.created_at },
  }));

  // Fire-and-forget: a failed "last opened" write must not block the page.
  void touchProject(project.id).catch(() => {});

  return (
    <Workspace
      project={project}
      conversationId={conversationId}
      initialMessages={initialMessages}
      files={files}
      models={catalog.models}
      catalogFetchedAt={catalog.catalogFetchedAt}
      balance={balance?.balance ?? 0}
      email={user.email ?? ""}
      displayName={profile?.display_name}
      // On an untouched project the composer opens on the idea the project was
      // created from — the description typed when it was created. Once there is
      // a conversation, it seeds nothing.
      seededPrompt={
        initialMessages.length === 0 ? (project.description ?? undefined) : undefined
      }
      studioConnected={connection?.status === "connected"}
      blueprint={approvedBlueprint}
    />
  );
}
