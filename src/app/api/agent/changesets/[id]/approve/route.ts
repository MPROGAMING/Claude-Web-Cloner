import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { loadChangeset, setChangesetStatus } from "@/lib/agent/audit";
import { toPreview } from "@/lib/agent/changesets";
import { logger } from "@/lib/logger";

/**
 * Approve a proposed change set.
 *
 * This endpoint is the authorization event. It exists as its own explicit user
 * action precisely so that approval cannot be produced by the model, by
 * retrieved documentation, or by anything the user happens to type in chat —
 * the only way to reach it is to press the control.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const changeset = await loadChangeset(supabase, id, user.id);
    if (!changeset) throw new AppError("not_found", "That change set does not exist.", 404);

    if (changeset.status === "applied") {
      throw new AppError("conflict", "Those changes have already been applied.", 409);
    }
    if (changeset.issues.some((issue) => issue.severity === "error")) {
      throw new AppError(
        "validation_failed",
        "Those changes did not pass validation and cannot be approved.",
        422,
      );
    }

    await setChangesetStatus(supabase, id, "approved", { approvedAt: new Date().toISOString() });
    logger.info("agent.changeset.approved", {
      changesetId: id,
      runId: changeset.runId,
      operations: changeset.operations.length,
    });

    return NextResponse.json({
      ok: true,
      changeset: toPreview({ ...changeset, status: "approved" }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
