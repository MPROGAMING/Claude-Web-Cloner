import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";

/**
 * The workspace re-reads the file tree after each generation. RLS scopes the
 * result to the caller, and the explicit ownership check turns "someone else's
 * project id" into a 404 rather than an empty list.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!project) throw new AppError("not_found", "That project does not exist.", 404);

    const { data: files, error } = await supabase
      .from("project_files")
      .select("*")
      .eq("project_id", id)
      .order("path");

    if (error) throw new AppError("database_error", "Could not load the project files.", 500);

    return NextResponse.json({ files: files ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
