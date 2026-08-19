import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";

/**
 * A file's stored history.
 *
 * `file_revisions` is written by the agent executor, by revert and by a hand
 * edit, which makes it the one record of what a file used to be. Listing it
 * without content keeps the response bounded — a file may be 200 KB and have
 * dozens of revisions — and a single revision's content is fetched only when
 * the reader actually opens it.
 */

const MAX_REVISIONS = 50;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const { id, fileId } = await context.params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    // Ownership of the *file* is what matters, and it carries the project id —
    // so a mismatched pair is a 404 rather than a read of someone else's row.
    const { data: file } = await supabase
      .from("project_files")
      .select("id, project_id, revision")
      .eq("id", fileId)
      .eq("project_id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!file) throw new AppError("not_found", "That file does not exist.", 404);

    const requested = new URL(request.url).searchParams.get("revision");

    if (requested !== null) {
      const revision = Number.parseInt(requested, 10);
      if (!Number.isInteger(revision) || revision < 1) {
        throw new AppError("invalid_request", "That is not a revision number.", 400);
      }

      const { data: row } = await supabase
        .from("file_revisions")
        .select("revision, content, created_at")
        .eq("file_id", fileId)
        .eq("revision", revision)
        .maybeSingle();

      if (!row) throw new AppError("not_found", "That revision was not kept.", 404);
      return NextResponse.json({ revision: row.revision, content: row.content, createdAt: row.created_at });
    }

    const { data: rows, error } = await supabase
      .from("file_revisions")
      .select("revision, created_at")
      .eq("file_id", fileId)
      .order("revision", { ascending: false })
      .limit(MAX_REVISIONS);

    if (error) throw new AppError("database_error", "Could not load the file history.", 500);

    return NextResponse.json({
      current: file.revision,
      revisions: (rows ?? []).map((row) => ({
        revision: row.revision,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
