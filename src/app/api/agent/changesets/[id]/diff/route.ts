import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { loadChangeset } from "@/lib/agent/audit";
import { validateProjectPath } from "@/lib/roblox/project-model";

/**
 * The exact before/after content a change set will write.
 *
 * `toPreview()` deliberately omits content, because the change *summary* is a
 * list of paths and does not need it. The approval decision does: a user asked
 * to consent to a write is entitled to read the write. This is the one place
 * that content is served, and it serves the caller's own rows only.
 *
 * The diff itself is computed in the browser. The server's job is to be the
 * authority on what is currently stored and what is staged; deciding how many
 * lines of context to show is not a server concern, and computing it here would
 * mean a round trip every time someone switched between inline and split.
 */

interface DiffFile {
  kind: string;
  path: string;
  toPath?: string;
  summary: string;
  /** Current stored content, or null when the file does not exist yet. */
  before: string | null;
  /** Content after the change set is applied, or null when it deletes the file. */
  after: string | null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const changeset = await loadChangeset(supabase, id, user.id);
    if (!changeset) throw new AppError("not_found", "That change set does not exist.", 404);

    // Every path in a stored change set is re-validated before it is used to
    // read, exactly as it is before it is used to write.
    const paths = new Set<string>();
    for (const op of changeset.operations) {
      for (const candidate of [op.path, op.toPath]) {
        if (!candidate) continue;
        const validation = validateProjectPath(candidate);
        if (validation.ok && validation.path) paths.add(validation.path);
      }
    }

    const { data: rows } = await supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", changeset.projectId)
      .in("path", [...paths]);

    const stored = new Map((rows ?? []).map((row) => [row.path, row.content]));

    const files: DiffFile[] = changeset.operations.map((op) => {
      const current = stored.get(op.path) ?? null;

      if (op.kind === "delete") {
        return { kind: op.kind, path: op.path, summary: op.summary, before: current, after: null };
      }
      if (op.kind === "move" || op.kind === "rename") {
        return {
          kind: op.kind,
          path: op.path,
          toPath: op.toPath,
          summary: op.summary,
          before: current,
          after: op.content ?? current,
        };
      }
      return {
        kind: op.kind,
        path: op.path,
        summary: op.summary,
        // A create writes into empty space; showing the current file as the
        // "before" of a create would be a lie the changeset builder already
        // refuses to stage.
        before: op.kind === "create" ? null : current,
        after: op.content ?? null,
      };
    });

    return NextResponse.json({
      changesetId: changeset.changesetId,
      status: changeset.status,
      projectId: changeset.projectId,
      files,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
