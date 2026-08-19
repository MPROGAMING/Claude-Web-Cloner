import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMemory } from "@/lib/memory/service";
import { summariseMemory } from "@/lib/memory/facts";
import { AppError, errorResponse } from "@/lib/errors";

/**
 * What the agent remembers about this project.
 *
 * Read by the Memory panel after every turn, so a creator can see a fact appear
 * the moment it is recorded rather than discovering it days later in an answer
 * they did not expect. Superseded facts come back too — a correction the user
 * cannot see is indistinguishable from the agent quietly changing its mind.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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

    const all = await listMemory(supabase, id, { includeSuperseded: true });
    const live = all.filter((fact) => !fact.supersededBy);

    return NextResponse.json({
      facts: live,
      superseded: all.filter((fact) => fact.supersededBy),
      summary: summariseMemory(live),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
