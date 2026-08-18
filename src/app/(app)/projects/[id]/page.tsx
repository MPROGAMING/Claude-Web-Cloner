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
import { getTemplate } from "@/lib/templates";
import { touchProject } from "@/lib/actions/projects";
import type { BlockwrightUIMessage } from "@/lib/ai/types";
import { createClient } from "@/lib/supabase/server";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seed?: string }>;
}) {
  const [{ id }, { seed }] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireUser();

  const project = await getProject(id);
  if (!project) notFound();

  const [profile, balance, files, conversations, connection, catalog] = await Promise.all([
    getProfile(),
    getCreditBalance(),
    listProjectFiles(project.id),
    listConversations(project.id),
    getConnection(supabase, project.id, user.id),
    listClientModels(),
  ]);

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

  const template = seed ? getTemplate(seed) : undefined;

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
      seededPrompt={initialMessages.length === 0 ? template?.prompt : undefined}
      studioConnected={connection?.status === "connected"}
    />
  );
}
