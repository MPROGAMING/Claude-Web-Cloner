import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { blueprintSchema, reviewBlueprint } from "@/lib/blueprint/schema";
import { logger } from "@/lib/logger";

/**
 * Approve a blueprint.
 *
 * This is the authorization event for autonomous building: from here the agent
 * treats these decisions as settled and does not re-ask. Like the change-set
 * approval it is its own explicit endpoint, reachable only from a deliberate
 * user action — never from something the model said or the user typed in chat.
 *
 * Approving supersedes any previously approved blueprint, so the agent is never
 * following two conflicting sets of decisions.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const { data: row } = await supabase
      .from("game_blueprints")
      .select("id, project_id, blueprint, status")
      .eq("id", id)
      .maybeSingle();

    if (!row) throw new AppError("not_found", "That plan does not exist.", 404);
    if (row.status === "approved") {
      return NextResponse.json({ ok: true, alreadyApproved: true });
    }
    if (!row.blueprint) {
      throw new AppError("conflict", "That plan has not been generated yet.", 409);
    }

    // Re-validate before it becomes binding context for every future build.
    const parsed = blueprintSchema.safeParse(row.blueprint);
    if (!parsed.success) {
      throw new AppError("validation_failed", "That plan is not complete enough to approve.", 422);
    }
    const issues = reviewBlueprint(parsed.data);
    if (issues.some((issue) => issue.severity === "error")) {
      throw new AppError("validation_failed", "That plan still has unresolved problems.", 422, {
        issues,
      });
    }

    // Supersede the previous approval first; the partial unique index allows
    // only one approved blueprint per project.
    await supabase
      .from("game_blueprints")
      .update({ status: "superseded" })
      .eq("project_id", row.project_id)
      .eq("status", "approved");

    const { error } = await supabase
      .from("game_blueprints")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new AppError("database_error", "Could not approve that plan.", 500);

    await supabase.from("activity_events").insert({
      owner_id: user.id,
      project_id: row.project_id,
      kind: "blueprint.approved",
      summary: `Approved the plan for ${parsed.data.title}`,
      detail: { blueprintId: id, scope: parsed.data.scope } as never,
    });

    logger.info("blueprint.approved", { blueprintId: id, projectId: row.project_id });
    return NextResponse.json({ ok: true, approved: true });
  } catch (error) {
    return errorResponse(error);
  }
}
