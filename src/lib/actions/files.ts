"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/queries";
import { toAppError } from "@/lib/errors";
import {
  MAX_FILE_BYTES,
  inferKind,
  inferService,
  validateProjectPath,
} from "@/lib/roblox/project-model";
import { logger } from "@/lib/logger";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Hand edits to project files.
 *
 * The agent's writes go through `ChangesetBuilder` and the executor. A person
 * typing in the editor is a second write path, and it gets the same three
 * guarantees rather than a shortcut: the path goes through `validateProjectPath`
 * (a user-supplied path is no more trusted than a model-supplied one — it
 * arrives over the same wire), the previous content is snapshotted into
 * `file_revisions` so the edit is undoable and diffable, and the write is
 * conditional on the revision the editor was showing.
 */

const contentSchema = z
  .string()
  .max(MAX_FILE_BYTES, `Files are limited to ${MAX_FILE_BYTES} bytes.`);

const saveSchema = z.object({
  projectId: z.string().uuid(),
  path: z.string().min(1).max(240),
  content: contentSchema,
  expectedRevision: z.number().int().positive().optional(),
});

export interface SaveFileResult {
  revision: number;
  sizeBytes: number;
}

async function assertOwnedProject(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  projectId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Save an edit to an existing file.
 *
 * `expectedRevision` is what the editor had open. A generation that lands while
 * someone is typing bumps the revision, and silently overwriting it would throw
 * away work that the user watched arrive — so the mismatch is reported and the
 * editor offers the diff instead.
 */
export async function saveFile(input: {
  projectId: string;
  path: string;
  content: string;
  expectedRevision?: number;
}): Promise<ActionResult<SaveFileResult>> {
  try {
    const { supabase, user } = await requireUser();

    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "That edit was not valid." };
    }

    const validation = validateProjectPath(parsed.data.path);
    if (!validation.ok || !validation.path) {
      return { ok: false, error: validation.reason ?? "That path is not allowed." };
    }
    const path = validation.path;

    const bytes = Buffer.byteLength(parsed.data.content, "utf8");
    if (bytes > MAX_FILE_BYTES) {
      return { ok: false, error: `That file is ${bytes} bytes; the limit is ${MAX_FILE_BYTES}.` };
    }

    if (!(await assertOwnedProject(supabase, parsed.data.projectId, user.id))) {
      return { ok: false, error: "That project does not exist." };
    }

    const { data: file } = await supabase
      .from("project_files")
      .select("id, content, revision")
      .eq("project_id", parsed.data.projectId)
      .eq("path", path)
      .maybeSingle();

    if (!file) return { ok: false, error: "That file no longer exists." };

    if (parsed.data.expectedRevision !== undefined && parsed.data.expectedRevision !== file.revision) {
      return {
        ok: false,
        error: `This file changed on the server (now revision ${file.revision}). Reopen it to see what changed.`,
      };
    }

    if (file.content === parsed.data.content) {
      return { ok: true, data: { revision: file.revision, sizeBytes: bytes } };
    }

    // Snapshot first: if the update fails the history still describes reality,
    // whereas an unrecorded overwrite is unrecoverable.
    const { error: snapshotError } = await supabase.from("file_revisions").insert({
      file_id: file.id,
      project_id: parsed.data.projectId,
      owner_id: user.id,
      revision: file.revision,
      content: file.content,
    });
    if (snapshotError) {
      logger.error("file.save.snapshot_failed", { error: snapshotError.message });
      return { ok: false, error: "Could not save that file." };
    }

    const nextRevision = file.revision + 1;
    const { error } = await supabase
      .from("project_files")
      .update({
        content: parsed.data.content,
        size_bytes: bytes,
        revision: nextRevision,
        updated_at: new Date().toISOString(),
      })
      .eq("id", file.id)
      // Belt and braces against a concurrent write between the read and here.
      .eq("revision", file.revision);

    if (error) {
      logger.error("file.save.failed", { error: error.message });
      return { ok: false, error: "Could not save that file." };
    }

    await supabase
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", parsed.data.projectId);

    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { revision: nextRevision, sizeBytes: bytes } };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}

/** Create a new file by hand. The path is the untrusted part, so it is checked first. */
export async function createFile(input: {
  projectId: string;
  path: string;
  content?: string;
}): Promise<ActionResult<{ path: string }>> {
  try {
    const { supabase, user } = await requireUser();

    const parsed = z
      .object({
        projectId: z.string().uuid(),
        path: z.string().min(1).max(240),
        content: contentSchema.optional(),
      })
      .safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "That file was not valid." };
    }

    const validation = validateProjectPath(parsed.data.path);
    if (!validation.ok || !validation.path) {
      return { ok: false, error: validation.reason ?? "That path is not allowed." };
    }
    const path = validation.path;

    if (!(await assertOwnedProject(supabase, parsed.data.projectId, user.id))) {
      return { ok: false, error: "That project does not exist." };
    }

    const content = parsed.data.content ?? "";
    const { error } = await supabase.from("project_files").insert({
      project_id: parsed.data.projectId,
      owner_id: user.id,
      path,
      content,
      kind: inferKind(path),
      roblox_parent: inferService(path),
      size_bytes: Buffer.byteLength(content, "utf8"),
    });

    if (error) {
      // 23505 is the (project_id, path) unique index; that one is the user's to
      // fix, so it gets a real message rather than the generic failure.
      if (error.code === "23505") return { ok: false, error: `${path} already exists.` };
      logger.error("file.create.failed", { error: error.message });
      return { ok: false, error: "Could not create that file." };
    }

    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { path } };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}
