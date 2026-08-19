"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/data/queries";
import { AppError, toAppError } from "@/lib/errors";
import { getTemplate } from "@/lib/templates";
import { DEFAULT_MODEL_ID, getModel } from "@/lib/ai/registry";
import { createPairingCode, disconnectStudio, enqueueStudioCommand, getConnection } from "@/lib/studio/service";
import { MAX_CONTENT_CHARS, MEMORY_KINDS, type MemoryKind } from "@/lib/memory/facts";
import { forgetMemory, recordMemory } from "@/lib/memory/service";
import { logger } from "@/lib/logger";

/**
 * Project mutations.
 *
 * All of these run on the server with the user's own client, so RLS is the
 * final authority. Each action still checks ownership explicitly to produce a
 * useful message rather than a silent zero-row update.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

const nameSchema = z.string().trim().min(1, "Give the project a name.").max(80);

export async function createProject(formData: FormData): Promise<never | ActionResult> {
  try {
    const { supabase, user } = await requireUser();

    const parsed = z
      .object({
        name: nameSchema,
        description: z.string().trim().max(500).optional(),
        templateSlug: z.string().max(60).optional(),
        modelId: z.string().max(120).optional(),
      })
      .safeParse({
        name: formData.get("name"),
        description: formData.get("description") || undefined,
        templateSlug: formData.get("templateSlug") || undefined,
        modelId: formData.get("modelId") || undefined,
      });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    }

    const template = parsed.data.templateSlug ? getTemplate(parsed.data.templateSlug) : undefined;
    const modelId = getModel(parsed.data.modelId ?? "")?.id ?? DEFAULT_MODEL_ID;

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? template?.tagline ?? null,
        template_slug: template?.slug ?? null,
        model_id: modelId,
        icon: template?.icon ?? "blocks",
      })
      .select("id")
      .single();

    if (error || !project) {
      logger.error("project.create.failed", { error: String(error?.message) });
      return { ok: false, error: "Could not create the project." };
    }

    await supabase.from("conversations").insert({
      project_id: project.id,
      owner_id: user.id,
      title: "New conversation",
    });

    await supabase.from("activity_events").insert({
      owner_id: user.id,
      project_id: project.id,
      kind: "project.created",
      summary: `Created project "${parsed.data.name}"`,
      detail: { template: template?.slug ?? null } as never,
    });

    revalidatePath("/projects");
    revalidatePath("/dashboard");
    redirect(`/projects/${project.id}${template ? `?seed=${template.slug}` : ""}`);
  } catch (error) {
    // redirect() throws by design — let it through.
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toAppError(error).message };
  }
}

export async function renameProject(projectId: string, name: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

    const { error } = await supabase
      .from("projects")
      .update({ name: parsed.data })
      .eq("id", projectId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: "Could not rename the project." };

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

export async function setProjectModel(projectId: string, modelId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const model = getModel(modelId);
    if (!model) return { ok: false, error: "That model is not available." };

    const { error } = await supabase
      .from("projects")
      .update({ model_id: model.id })
      .eq("id", projectId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: "Could not switch model." };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

export async function duplicateProject(projectId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, user } = await requireUser();

    const { data: source } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!source) return { ok: false, error: "That project no longer exists." };

    const { data: copy, error } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        name: `${source.name} copy`.slice(0, 80),
        description: source.description,
        model_id: source.model_id,
        template_slug: source.template_slug,
        icon: source.icon,
      })
      .select("id")
      .single();

    if (error || !copy) return { ok: false, error: "Could not duplicate the project." };

    const { data: files } = await supabase
      .from("project_files")
      .select("path, content, kind, roblox_parent, size_bytes")
      .eq("project_id", projectId);

    if (files?.length) {
      await supabase.from("project_files").insert(
        files.map((file) => ({
          project_id: copy.id,
          owner_id: user.id,
          path: file.path,
          content: file.content,
          kind: file.kind,
          roblox_parent: file.roblox_parent,
          size_bytes: file.size_bytes,
        })),
      );
    }

    // A duplicate starts a fresh conversation — the history belongs to the original.
    await supabase.from("conversations").insert({
      project_id: copy.id,
      owner_id: user.id,
      title: "New conversation",
    });

    revalidatePath("/projects");
    return { ok: true, data: { id: copy.id } };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

export async function setProjectStatus(
  projectId: string,
  status: "active" | "archived",
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("projects")
      .update({ status })
      .eq("id", projectId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: "Could not update the project." };
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: "Could not delete the project." };
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

export async function touchProject(projectId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("projects")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("owner_id", user.id);
}

/** Starts a new conversation thread inside a project. */
export async function createConversation(projectId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("conversations")
      .insert({ project_id: projectId, owner_id: user.id, title: "New conversation" })
      .select("id")
      .single();

    if (error || !data) return { ok: false, error: "Could not start a new chat." };
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

/** Reverts a file to its previous stored revision. */
export async function revertFile(fileId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();

    const { data: file } = await supabase
      .from("project_files")
      .select("id, project_id, revision, content")
      .eq("id", fileId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!file) return { ok: false, error: "That file no longer exists." };

    const { data: previous } = await supabase
      .from("file_revisions")
      .select("content, revision")
      .eq("file_id", fileId)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!previous) return { ok: false, error: "There is no earlier version to restore." };

    // Snapshot the current content first so revert is itself undoable.
    await supabase.from("file_revisions").insert({
      file_id: file.id,
      project_id: file.project_id,
      owner_id: user.id,
      revision: file.revision,
      content: file.content,
    });

    await supabase
      .from("project_files")
      .update({
        content: previous.content,
        revision: file.revision + 1,
        size_bytes: Buffer.byteLength(previous.content, "utf8"),
      })
      .eq("id", fileId);

    revalidatePath(`/projects/${file.project_id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

// --- Studio ---------------------------------------------------------------

export async function startStudioPairing(
  projectId: string,
): Promise<ActionResult<{ code: string; expiresAt: string }>> {
  try {
    const { supabase, user } = await requireUser();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!project) throw new AppError("not_found", "That project does not exist.", 404);

    const { code, expiresAt } = await createPairingCode(supabase, projectId, user.id);
    return { ok: true, data: { code, expiresAt } };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

export async function endStudioSession(projectId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    await disconnectStudio(supabase, projectId, user.id);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

/** Manual "push everything to Studio" from the panel. */
export async function syncProjectToStudio(projectId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const connection = await getConnection(supabase, projectId, user.id);

    if (!connection || connection.status !== "connected") {
      return { ok: false, error: "Roblox Studio is not connected to this project." };
    }

    await enqueueStudioCommand(supabase, {
      projectId,
      userId: user.id,
      connectionId: connection.id,
      action: "sync_files",
      payload: { action: "sync_files" },
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

// --- Project memory -------------------------------------------------------

/**
 * Delete one remembered fact.
 *
 * Ownership is checked twice — once here for a useful message, once by RLS for
 * real. The correction history behind the fact goes with it (the FK cascades),
 * so deleting a fact cannot resurrect the older one it replaced.
 */
export async function forgetProjectMemory(
  projectId: string,
  factId: string,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();

    const parsed = z.string().uuid().safeParse(factId);
    if (!parsed.success) return { ok: false, error: "That is not a memory id." };

    const removed = await forgetMemory(supabase, parsed.data, user.id);
    if (!removed) return { ok: false, error: "That memory no longer exists." };

    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

/**
 * Add a fact by hand.
 *
 * The agent writes most of these, but a creator who has just been contradicted
 * needs a way to state the rule directly rather than hoping the next turn picks
 * it up. Recorded as `user`, which outranks `agent` in the prompt.
 */
export async function rememberProjectFact(
  projectId: string,
  input: { kind: MemoryKind; content: string },
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();

    const parsed = z
      .object({ kind: z.enum(MEMORY_KINDS), content: z.string().max(MAX_CONTENT_CHARS) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: "Check the fact and try again." };

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!project) return { ok: false, error: "That project does not exist." };

    const result = await recordMemory(supabase, {
      projectId,
      userId: user.id,
      kind: parsed.data.kind,
      content: parsed.data.content,
      source: "user",
    });

    if (!result.ok) return { ok: false, error: result.error };
    if (result.deduped) return { ok: false, error: "That is already remembered." };

    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}
