import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConnection, listRecentCommands } from "@/lib/studio/service";
import { AppError, errorResponse } from "@/lib/errors";

/**
 * Polled by the Studio panel so the connection indicator reflects reality
 * without a websocket. Cheap: two indexed reads scoped to one project.
 */
export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) throw new AppError("invalid_request", "projectId is required.", 400);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) throw new AppError("not_found", "That project does not exist.", 404);

    const [connection, commands] = await Promise.all([
      getConnection(supabase, projectId, user.id),
      listRecentCommands(supabase, projectId, user.id, 8),
    ]);

    return NextResponse.json({
      status: connection?.status ?? "pending",
      placeName: connection?.place_name ?? null,
      lastSeenAt: connection?.last_seen_at ?? null,
      commands: commands.map((command) => ({
        id: command.id,
        action: command.action,
        status: command.status,
        summary: command.error_message ?? null,
        createdAt: command.created_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
