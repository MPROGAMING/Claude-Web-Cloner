import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Ask a run to stop.
 *
 * Cancellation is a flag the run polls between steps rather than an interrupt,
 * so a cancelled run always stops at a defined point instead of unwinding from
 * the middle of a tool call and leaving a half-written change set behind.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const { data: run } = await supabase
      .from("agent_runs")
      .select("id, owner_id, state")
      .eq("id", id)
      .maybeSingle();

    if (!run) throw new AppError("not_found", "That run does not exist.", 404);
    if (run.owner_id !== user.id) throw new AppError("forbidden", "That run is not yours.", 403);

    if (["COMPLETED", "FAILED", "CANCELLED"].includes(run.state)) {
      return NextResponse.json({ ok: true, alreadyFinished: true, state: run.state });
    }

    await supabase.from("agent_runs").update({ cancelled: true }).eq("id", id);
    logger.info("agent.run.cancel_requested", { runId: id });

    return NextResponse.json({ ok: true, cancelled: true });
  } catch (error) {
    return errorResponse(error);
  }
}
