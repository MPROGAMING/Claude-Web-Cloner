import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { loadChangeset, setChangesetStatus } from "@/lib/agent/audit";
import { undoChangeset } from "@/lib/agent/executor";
import { logger } from "@/lib/logger";

/** Undo an applied change set by replaying the inverse of its operations. */
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
    if (changeset.status !== "applied") {
      throw new AppError("conflict", "Only an applied change set can be undone.", 409);
    }

    const result = await undoChangeset(supabase, changeset, user.id);
    await setChangesetStatus(supabase, id, result.ok ? "rolled_back" : "failed");

    logger.info("agent.changeset.undone", { changesetId: id, ok: result.ok, reverted: result.applied });
    return NextResponse.json({ ok: result.ok, reverted: result.applied, operations: result.operations });
  } catch (error) {
    return errorResponse(error);
  }
}
